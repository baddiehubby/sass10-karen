import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ingestLifeContext } from "@/lib/karen/interview/context-engine";
import { classifyAnswerClaim } from "@/lib/karen/interview/followup-engine";
import { createKarenOrchestrator } from "@/lib/karen/interview/orchestrator";
import { recordedRefsFromContext } from "@/lib/karen/interview/personality-controller";
import {
  createMemoryKarenSessionStore,
  recordLifeFact,
  selectLatestRelevantExcuse,
} from "@/lib/karen/interview/session-memory";
import { createEmptyInterviewState } from "@/lib/karen/interview/types";

describe("Karen Stage 6A hardening", () => {
  it("does not present stale excuses as the latest excuse", async () => {
    const store = createMemoryKarenSessionStore();
    const karen = createKarenOrchestrator({
      store,
      userId: "mem_rel",
      personality: { mood: "sarcastic", intensity: 3 },
    });
    await karen.seedFact({ kind: "excuse", text: "old traffic excuse", key: "old traffic" });
    await karen.seedFact({ kind: "promise", text: "gym daily", key: "gym daily" });

    const ask = await karen.askNextQuestion();
    assert.ok(ask.activeQuestionId);
    await karen.handleAnswer("I was busy", {
      questionId: ask.activeQuestionId!,
      expectedRung: "surface",
    });

    const state = await karen.getState();
    const latest = selectLatestRelevantExcuse(state.facts);
    assert.ok(latest);
    assert.match(latest!.text, /busy/i);
    assert.notEqual(latest!.key, "old traffic");
    assert.ok(state.facts.some((f) => f.key === "old traffic"), "history retained");

    const refs = recordedRefsFromContext(ingestLifeContext(state));
    assert.equal(refs.excuses.length, 1);
    assert.match(refs.excuses[0]!, /busy/i);
    assert.equal(refs.excuses.some((e) => /traffic/i.test(e)), false);
  });

  it("treats concrete self-report as concrete_defense unless a prior completion exists", () => {
    const empty = ingestLifeContext(createEmptyInterviewState("ev1"));
    const selfReport = classifyAnswerClaim("I went to the gym for 45 minutes", empty);
    assert.equal(selfReport.claimKind, "concrete_defense");

    let withCompletion = createEmptyInterviewState("ev2");
    withCompletion = recordLifeFact(withCompletion, {
      kind: "completion",
      text: "went to the gym for 45 minutes",
      key: "gym 45 minutes",
      source: "seed",
    });
    const verified = classifyAnswerClaim(
      "I went to the gym for 45 minutes",
      ingestLifeContext(withCompletion),
    );
    assert.equal(verified.claimKind, "verified_fact");
  });

  it("orchestrator does not upgrade concrete_defense to verified_fact mid-turn", async () => {
    const store = createMemoryKarenSessionStore();
    const karen = createKarenOrchestrator({
      store,
      userId: "ev_orch",
      personality: { mood: "annoyed", intensity: 2 },
    });
    await karen.seedFact({ kind: "promise", text: "gym weekday", key: "gym weekday" });
    const ask = await karen.askNextQuestion();
    const out = await karen.handleAnswer("I spent 40 minutes on deadlifts at 6pm", {
      questionId: ask.activeQuestionId!,
      expectedRung: "surface",
    });
    assert.equal(out.claimKind, "concrete_defense");
    assert.equal(out.verdict, "solid");
    assert.match(out.message, /concrete_defense|Solid|specific action|kept/i);
    assert.equal(/verified_fact/i.test(out.message), false);
  });

  it("rejects stale question id and out-of-order rung submissions", async () => {
    const store = createMemoryKarenSessionStore();
    const karen = createKarenOrchestrator({
      store,
      userId: "stale",
      personality: { mood: "sweet", intensity: 2 },
    });
    await karen.seedFact({ kind: "promise", text: "call mom", key: "call mom" });
    const ask = await karen.askNextQuestion();
    const badQ = await karen.handleAnswer("I was busy", {
      questionId: "not-the-active-id",
      expectedRung: "surface",
    });
    assert.equal(badQ.rejectedStale, true);
    assert.equal(badQ.activeQuestionId, ask.activeQuestionId);

    const push = await karen.handleAnswer("I was busy", {
      questionId: ask.activeQuestionId!,
      expectedRung: "surface",
    });
    assert.equal(push.rung, "push");

    const badRung = await karen.handleAnswer("Still busy", {
      questionId: ask.activeQuestionId!,
      expectedRung: "surface",
    });
    assert.equal(badRung.rejectedStale, true);
    assert.equal(badRung.rung, "push");
  });

  it("clarification resumes the same question without advancing the ladder", async () => {
    const store = createMemoryKarenSessionStore();
    const karen = createKarenOrchestrator({
      store,
      userId: "clarify",
      personality: { mood: "sarcastic", intensity: 3 },
    });
    await karen.seedFact({ kind: "promise", text: "write one hour", key: "write one hour" });
    const ask = await karen.askNextQuestion();
    const qid = ask.activeQuestionId!;
    const unclear = await karen.handleAnswer("?", {
      questionId: qid,
      expectedRung: "surface",
    });
    assert.equal(unclear.nextAction, "await_clarification");
    assert.equal(unclear.rung, "surface");
    assert.equal(unclear.activeQuestionId, qid);

    const stateMid = await karen.getState();
    assert.equal(stateMid.activeRung, "surface");
    assert.equal(stateMid.awaitingClarification, true);

    const after = await karen.handleAnswer("I was busy", {
      questionId: qid,
      expectedRung: "surface",
    });
    assert.equal(after.rejectedStale, false);
    assert.equal(after.activeQuestionId, qid);
    // First scorable answer at surface may open push — not floor skipped.
    assert.equal(after.rung, "push");
    assert.notEqual(after.rung, "floor");
  });

  it("mood changes do not restart questions or mutate verdicts", async () => {
    const store = createMemoryKarenSessionStore();
    const karen = createKarenOrchestrator({
      store,
      userId: "mood",
      personality: { mood: "sweet", intensity: 2 },
    });
    await karen.seedFact({ kind: "promise", text: "ship v1", key: "ship v1" });
    const ask = await karen.askNextQuestion();
    const qid = ask.activeQuestionId!;
    const before = await karen.getState();

    await karen.changeMood("furious");
    await karen.setPersonality({ intensity: 5, allowTheatricalRoast: true });
    const after = await karen.getState();
    assert.equal(after.activeQuestionId, qid);
    assert.equal(after.activeRung, before.activeRung);
    assert.equal(after.awaitingClarification, before.awaitingClarification);
    assert.equal(after.lastAnswerFingerprint, before.lastAnswerFingerprint);
    assert.deepEqual(
      after.questions.map((q) => q.bestScore),
      before.questions.map((q) => q.bestScore),
    );

    const restyle = await karen.askNextQuestion();
    assert.equal(restyle.activeQuestionId, qid);
    assert.equal(restyle.mood, "furious");
  });

  it("recovers active state after reload at surface, push, floor, clarification, and verdict", async () => {
    const store = createMemoryKarenSessionStore();
    const userId = "reload_states";

    const a = createKarenOrchestrator({ store, userId, personality: { mood: "annoyed", intensity: 3 } });
    await a.seedFact({ kind: "promise", text: "gym weekday", key: "gym weekday" });
    const surface = await a.askNextQuestion();
    let b = createKarenOrchestrator({ store, userId, personality: { mood: "annoyed", intensity: 3 } });
    let again = await b.askNextQuestion();
    assert.equal(again.rung, "surface");
    assert.equal(again.activeQuestionId, surface.activeQuestionId);

    await b.handleAnswer("I was busy", {
      questionId: again.activeQuestionId!,
      expectedRung: "surface",
    });
    b = createKarenOrchestrator({ store, userId, personality: { mood: "annoyed", intensity: 3 } });
    again = await b.askNextQuestion();
    assert.equal(again.rung, "push");
    assert.equal(again.nextAction, "await_followup");

    await b.handleAnswer("Still busy", {
      questionId: again.activeQuestionId!,
      expectedRung: "push",
    });
    b = createKarenOrchestrator({ store, userId, personality: { mood: "annoyed", intensity: 3 } });
    again = await b.askNextQuestion();
    assert.equal(again.rung, "floor");

    await b.handleAnswer("?", {
      questionId: again.activeQuestionId!,
      expectedRung: "floor",
    });
    b = createKarenOrchestrator({ store, userId, personality: { mood: "annoyed", intensity: 3 } });
    again = await b.askNextQuestion();
    assert.equal(again.nextAction, "await_clarification");
    assert.equal(again.rung, "floor");

    const verdict = await b.handleAnswer("I didn't go. I skipped it.", {
      questionId: again.activeQuestionId!,
      expectedRung: "floor",
    });
    assert.equal(verdict.verdict, "failed");
    b = createKarenOrchestrator({ store, userId, personality: { mood: "annoyed", intensity: 3 } });
    const afterVerdict = await b.getState();
    assert.equal(afterVerdict.activeQuestionId, null);
    assert.ok(afterVerdict.committedVerdictQuestionIds.length >= 1);
  });

  it("is idempotent for duplicate submissions across process reload", async () => {
    const store = createMemoryKarenSessionStore();
    const userId = "idempotent";
    const a = createKarenOrchestrator({ store, userId, personality: { mood: "sweet", intensity: 2 } });
    await a.seedFact({ kind: "promise", text: "meditate", key: "meditate" });
    const ask = await a.askNextQuestion();
    const qid = ask.activeQuestionId!;
    const first = await a.handleAnswer("I was busy", {
      questionId: qid,
      expectedRung: "surface",
    });
    assert.equal(first.duplicateIgnored, false);
    assert.equal(first.rung, "push");

    // Same answer + same rung after reload → duplicate (fingerprint persisted).
    const b = createKarenOrchestrator({ store, userId, personality: { mood: "sweet", intensity: 2 } });
    // Advance once at push (new fingerprint), then duplicate that push answer across reload.
    const pushOnce = await b.handleAnswer("Still busy", {
      questionId: qid,
      expectedRung: "push",
    });
    assert.equal(pushOnce.duplicateIgnored, false);
    assert.equal(pushOnce.rung, "floor");

    const c = createKarenOrchestrator({ store, userId, personality: { mood: "sweet", intensity: 2 } });
    const cross = await c.handleAnswer("Still busy", {
      questionId: qid,
      expectedRung: "push",
    });
    assert.equal(cross.rejectedStale, true); // active rung is floor now

    const d = createKarenOrchestrator({ store, userId, personality: { mood: "sweet", intensity: 2 } });
    const floorDup1 = await d.handleAnswer("Still busy", {
      questionId: qid,
      expectedRung: "floor",
    });
    const floorDup2 = await d.handleAnswer("Still busy", {
      questionId: qid,
      expectedRung: "floor",
    });
    assert.ok(
      floorDup2.duplicateIgnored || floorDup2.verdictReplayed || floorDup2.rejectedStale,
      "second floor submit must not re-evaluate",
    );
    if (floorDup1.verdict) {
      assert.ok(floorDup1.verdict === "failed" || floorDup1.verdict === "shaky");
    }
  });

  it("runs a corrected 10-turn transcript with concrete_defense (not false verified_fact)", async () => {
    const store = createMemoryKarenSessionStore();
    const karen = createKarenOrchestrator({
      store,
      userId: "transcript6a",
      personality: { mood: "sarcastic", intensity: 3 },
    });
    const lines: string[] = [];
    const log = (n: number, role: string, text: string, meta?: string) => {
      lines.push(`[${n}] ${role}: ${text}${meta ? ` (${meta})` : ""}`);
    };

    await karen.seedFact({
      kind: "promise",
      text: "go to the gym every weekday",
      key: "gym weekday",
    });

    let t = 1;
    let out = await karen.askNextQuestion();
    log(t, "karen", out.message, `rung=${out.rung}`);
    const q1 = out.activeQuestionId!;

    t = 2;
    out = await karen.handleAnswer("I was busy", { questionId: q1, expectedRung: "surface" });
    log(t, "user", "I was busy");
    log(t, "karen", out.message, `rung=${out.rung}`);
    assert.equal(out.rung, "push");

    t = 3;
    // Duplicate of the surface answer binding after reload must be rejected as stale rung,
    // while an identical push answer twice is idempotent.
    const re3 = createKarenOrchestrator({
      store,
      userId: "transcript6a",
      personality: { mood: "sarcastic", intensity: 3 },
    });
    const staleSurface = await re3.handleAnswer("I was busy", {
      questionId: q1,
      expectedRung: "surface",
    });
    assert.equal(staleSurface.rejectedStale, true);
    out = await re3.handleAnswer("I was busy", { questionId: q1, expectedRung: "push" });
    log(t, "user", "I was busy");
    log(t, "karen", out.message, `rung=${out.rung}`);
    assert.equal(out.rung, "floor");
    const dupPush = await re3.handleAnswer("I was busy", { questionId: q1, expectedRung: "push" });
    assert.equal(dupPush.rejectedStale, true);

    t = 4;
    out = await re3.handleAnswer("Still busy, whatever", {
      questionId: q1,
      expectedRung: "floor",
    });
    log(t, "user", "Still busy, whatever");
    log(t, "karen", out.message, `rung=${out.rung}; next=${out.nextAction}; claim=${out.claimKind}; verdict=${out.verdict}`);

    t = 5;
    if (out.verdict) {
      log(t, "system", "already verdicted on floor hand-wave", `verdict=${out.verdict}`);
      assert.ok(out.verdict === "failed" || out.verdict === "shaky");
    } else {
      out = await re3.handleAnswer("I didn't go. I skipped the gym.", {
        questionId: q1,
        expectedRung: "floor",
      });
      log(t, "user", "I didn't go. I skipped the gym.");
      log(t, "karen", out.message, `verdict=${out.verdict}; claim=${out.claimKind}`);
      assert.equal(out.verdict, "failed");
    }

    t = 6;
    out = await re3.askNextQuestion();
    log(t, "karen", out.message, `q=${out.activeQuestionId}`);
    const q2 = out.activeQuestionId!;

    t = 7;
    out = await re3.handleAnswer("?", { questionId: q2, expectedRung: "surface" });
    log(t, "user", "?");
    log(t, "karen", out.message, `next=${out.nextAction}; rung=${out.rung}`);
    assert.equal(out.rung, "surface");

    t = 8;
    out = await re3.handleAnswer("Yeah I did it", { questionId: q2, expectedRung: "surface" });
    log(t, "user", "Yeah I did it");
    log(t, "karen", out.message, `rung=${out.rung}`);

    t = 9;
    await re3.changeMood("furious");
    await re3.setPersonality({ intensity: 5, allowTheatricalRoast: true });
    out = await re3.askNextQuestion();
    log(t, "system", "mood → furious @5");
    log(t, "karen", out.message, `mood=${out.mood}; q=${out.activeQuestionId}; rung=${out.rung}`);
    assert.equal(out.activeQuestionId, q2);

    t = 10;
    // No prior completion seeded — must be concrete_defense, not verified_fact.
    out = await re3.handleAnswer("I went to the gym for 45 minutes", {
      questionId: out.activeQuestionId!,
      expectedRung: out.rung ?? "push",
    });
    log(t, "user", "I went to the gym for 45 minutes");
    log(t, "karen", out.message, `verdict=${out.verdict}; claim=${out.claimKind}; mood=${out.mood}`);
    assert.equal(out.claimKind, "concrete_defense");
    assert.equal(out.verdict, "solid");
    assert.equal(/Claim kind: verified_fact/i.test(out.message), false);
    assert.match(out.message, /Claim kind: concrete_defense/i);

    (globalThis as { __karenTranscript6a?: string }).__karenTranscript6a = lines.join("\n\n");
    assert.ok(lines.length >= 10);
  });
});
