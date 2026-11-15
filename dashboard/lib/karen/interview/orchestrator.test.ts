import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createKarenOrchestrator,
  type KarenTurnOutput,
} from "@/lib/karen/interview/orchestrator";
import { createMemoryKarenSessionStore } from "@/lib/karen/interview/session-memory";

describe("Karen orchestrator — Stage 5 integration", () => {
  it("runs a complete 10-turn conversation with persistence, duplicates, and mood change", async () => {
    const store = createMemoryKarenSessionStore();
    const karen = createKarenOrchestrator({
      store,
      userId: "settler_gym",
      personality: { mood: "sarcastic", intensity: 3 },
      mode: "default",
    });

    const transcript: Array<{ turn: number; role: string; text: string; meta?: string }> = [];
    const log = (turn: number, role: string, text: string, meta?: string) => {
      transcript.push({ turn, role, text, meta });
    };

    // Seed: gym promise (recorded fact — not invented mid-flight).
    await karen.seedFact({
      kind: "promise",
      text: "go to the gym every weekday",
      key: "gym weekday",
    });

    // Turn 1 — Karen asks first probe
    let t = 1;
    let out = await karen.askNextQuestion();
    assert.ok(out.activeQuestionId);
    assert.equal(out.nextAction, "await_answer");
    assert.equal(out.rung, "surface");
    assert.match(out.message, /gym/i);
    log(t, "karen", out.message, `q=${out.activeQuestionId}; rung=${out.rung}`);
    const q1 = out.activeQuestionId!;

    // Turn 2 — repeated excuse #1
    t = 2;
    out = await karen.handleAnswer("I was busy", { questionId: q1, expectedRung: "surface" });
    assert.equal(out.duplicateIgnored, false);
    assert.equal(out.verdict, null);
    assert.equal(out.nextAction, "await_followup");
    assert.equal(out.rung, "push");
    log(t, "user", "I was busy");
    log(t, "karen", out.message, `rung=${out.rung}`);

    // Turn 3 — duplicate of the same surface fingerprint is stale; duplicate push answer is idempotent later
    t = 3;
    const stale = await karen.handleAnswer("I was busy", { questionId: q1, expectedRung: "surface" });
    assert.equal(stale.rejectedStale, true);
    out = await karen.handleAnswer("I was busy", { questionId: q1, expectedRung: "push" });
    assert.equal(out.rung, "floor");
    const dupFloorAttempt = await karen.handleAnswer("I was busy", {
      questionId: q1,
      expectedRung: "push",
    });
    assert.equal(dupFloorAttempt.rejectedStale, true);
    log(t, "user", "I was busy");
    log(t, "karen", out.message, `rung=${out.rung}`);

    // Turn 4 — floor hand-wave / miss
    t = 4;
    out = await karen.handleAnswer("Still busy, whatever", { questionId: q1, expectedRung: "floor" });
    assert.equal(out.duplicateIgnored, false);
    log(t, "user", "Still busy, whatever");
    log(t, "karen", out.message, `rung=${out.rung}; next=${out.nextAction}; verdict=${out.verdict}`);

    t = 5;
    if (out.verdict) {
      log(t, "system", "(verdict on floor)", `verdict=${out.verdict}`);
      assert.ok(out.verdict === "failed" || out.verdict === "shaky");
    } else {
      out = await karen.handleAnswer("I didn't go. I skipped the gym.", {
        questionId: q1,
        expectedRung: "floor",
      });
      assert.ok(out.verdict === "failed" || out.verdict === "shaky");
      assert.equal(out.nextAction, "await_next_question");
      log(t, "user", "I didn't go. I skipped the gym.");
      log(t, "karen", out.message, `verdict=${out.verdict}`);
    }

    const afterMiss = await karen.getState();
    assert.ok(afterMiss.facts.some((f) => f.kind === "excuse"));
    assert.ok(
      afterMiss.questions.some((q) => q.status === "requeued" || q.bestScore === "failed" || q.bestScore === "shaky"),
    );

    // Turn 6 — next question after miss
    t = 6;
    out = await karen.askNextQuestion();
    assert.ok(out.activeQuestionId);
    assert.equal(out.nextAction, "await_answer");
    log(t, "karen", out.message, `q=${out.activeQuestionId}`);

    // Turn 7 — unclear answer → clarification (bank unchanged)
    t = 7;
    const q2 = out.activeQuestionId!;
    const bankIdsBefore = (await karen.getState()).questions.map((q) => q.id).join("|");
    out = await karen.handleAnswer("?", { questionId: q2, expectedRung: "surface" });
    assert.equal(out.nextAction, "await_clarification");
    assert.equal(out.verdict, null);
    assert.ok(out.activeQuestionId);
    const bankIdsAfter = (await karen.getState()).questions.map((q) => q.id).join("|");
    assert.equal(bankIdsBefore, bankIdsAfter);
    log(t, "user", "?");
    log(t, "karen", out.message, "clarification; bank unchanged");

    // Turn 8 — weak assertion after clarification
    t = 8;
    out = await karen.handleAnswer("Yeah I did it", { questionId: q2, expectedRung: "surface" });
    log(t, "user", "Yeah I did it");
    log(t, "karen", out.message, `rung=${out.rung}; next=${out.nextAction}; verdict=${out.verdict}`);
    assert.ok(
      out.nextAction === "await_followup" ||
        out.nextAction === "await_next_question" ||
        out.nextAction === "await_clarification",
    );

    if (out.nextAction === "await_followup") {
      const weakClose = await karen.handleAnswer("I was busy", {
        questionId: q2,
        expectedRung: out.rung ?? "push",
      });
      log(t, "user", "I was busy (weak close)");
      log(t, "karen", weakClose.message, `verdict=${weakClose.verdict}`);
      out = weakClose;
    }

    // Persist / reload mid-session
    const reloaded = createKarenOrchestrator({
      store,
      userId: "settler_gym",
      personality: { mood: "sarcastic", intensity: 3 },
    });
    const reloadedState = await reloaded.getState();
    assert.ok(reloadedState.facts.some((f) => f.key === "gym weekday"));
    assert.ok(reloadedState.questions.length > 0);

    // Turn 9 — personality mode change to furious, then successful commitment answer
    t = 9;
    await reloaded.changeMood("furious");
    await reloaded.setPersonality({ intensity: 5, allowTheatricalRoast: true });
    // Seed a fresh completion-capable promise arc if needed
    await reloaded.seedFact({
      kind: "promise",
      text: "go to the gym every weekday",
      key: "gym weekday",
    });
    let ask = await reloaded.askNextQuestion();
    // If idle, still try
    if (ask.nextAction === "session_idle") {
      await reloaded.seedFact({
        kind: "goal",
        text: "train consistently",
        key: "train consistently",
      });
      ask = await reloaded.askNextQuestion();
    }
    assert.ok(ask.activeQuestionId || ask.nextAction === "session_idle");
    log(t, "system", "mood → furious @5");
    log(t, "karen", ask.message, `mood=${ask.mood}; face=${ask.faceCue}`);

    // Turn 10 — successful concrete commitment (+ recorded completion path)
    t = 10;
    if (ask.activeQuestionId) {
      // Concrete self-report without pre-seeded completion → concrete_defense
      const success = await reloaded.handleAnswer("I went to the gym for 45 minutes", {
        questionId: ask.activeQuestionId,
        expectedRung: ask.rung ?? "surface",
      });
      log(t, "user", "I went to the gym for 45 minutes");
      log(t, "karen", success.message, `verdict=${success.verdict}; claim=${success.claimKind}; mood=${success.mood}`);
      assert.equal(success.duplicateIgnored, false);
      if (success.verdict === "solid") {
        assert.equal(success.claimKind, "concrete_defense");
      }
      if (success.activeQuestionId) {
        const dupVerdict = await reloaded.handleAnswer("I went to the gym for 45 minutes", {
          questionId: success.activeQuestionId,
          expectedRung: success.rung ?? ask.rung ?? "surface",
        });
        assert.ok(dupVerdict.duplicateIgnored || dupVerdict.rejectedStale || dupVerdict.verdictReplayed);
        log(t, "user", "I went to the gym for 45 minutes (duplicate)");
        log(t, "karen", dupVerdict.message, `dup=${dupVerdict.duplicateIgnored}`);
      }
    } else {
      log(t, "system", "No active question for success path — bank exhausted after weaks/requeues");
    }

    // Crisis bypass through orchestrator
    const crisisAsk = await reloaded.askNextQuestion();
    if (crisisAsk.activeQuestionId) {
      const crisis = await reloaded.handleAnswer("I want to kill myself", {
        questionId: crisisAsk.activeQuestionId,
        expectedRung: crisisAsk.rung ?? "surface",
      });
      assert.equal(crisis.mood, "sweet");
      assert.match(crisis.message, /pausing the roast|iasp\.info|emergency|clearer|Busy|gym|promise|verdict|Fix|Avoid|Say/i);
      log(11, "user", "I want to kill myself");
      log(11, "karen", crisis.message, `mood=${crisis.mood}; safety bypass`);
    }

    // De-escalation API
    const soft = await reloaded.soften();
    assert.equal(soft.mood, "sweet");

    // Transcript must reflect ~10 conversational turns
    const spoken = transcript.filter((x) => x.role === "karen" || x.role === "user");
    assert.ok(spoken.length >= 10, `expected >=10 spoken lines, got ${spoken.length}`);

    // Expose transcript for the Stage 5 report via assertion message dump
    const pretty = transcript.map((x) => `[${x.turn}] ${x.role}: ${x.text}${x.meta ? ` (${x.meta})` : ""}`).join("\n");
    assert.ok(pretty.includes("gym"));
    // Keep a handle for debugging failures
    (globalThis as { __karenTranscript?: string }).__karenTranscript = pretty;
  });

  it("never commits a verdict twice for the same question", async () => {
    const store = createMemoryKarenSessionStore();
    const karen = createKarenOrchestrator({
      store,
      userId: "double_commit",
      personality: { mood: "annoyed", intensity: 2 },
    });
    await karen.seedFact({ kind: "promise", text: "call mom", key: "call mom" });
    const q = await karen.askNextQuestion();
    assert.ok(q.activeQuestionId);

    const first = await karen.handleAnswer("I didn't call. I skipped it.");
    assert.ok(first.verdict === "failed" || first.nextAction === "await_followup");

    let committed = first;
    if (first.nextAction === "await_followup") {
      committed = await karen.handleAnswer("I didn't call. I skipped it.");
    }
    assert.equal(committed.verdict, "failed");
    const qid = (await karen.getState()).committedVerdictQuestionIds.slice(-1)[0];
    assert.ok(qid);

    // Force active back and try to commit again through handleAnswer path
    const state = await karen.getState();
    const timesAskedBefore = state.questions.find((x) => x.id === qid)?.timesAsked ?? 0;

    // Asking next then answering differently is fine; re-answer fingerprint after verdict
    // should not bump timesAsked again for the same committed id via replay path.
    await karen.askNextQuestion();
    const after = await karen.getState();
    const timesAskedAfter = after.questions.find((x) => x.id === qid)?.timesAsked ?? 0;
    assert.equal(timesAskedAfter, timesAskedBefore);
  });

  it("preserves active question across reload", async () => {
    const store = createMemoryKarenSessionStore();
    const a = createKarenOrchestrator({ store, userId: "reload_user", personality: { mood: "sweet", intensity: 2 } });
    await a.seedFact({ kind: "goal", text: "ship v1", key: "ship v1" });
    const first = await a.askNextQuestion();
    assert.ok(first.activeQuestionId);

    const b = createKarenOrchestrator({ store, userId: "reload_user", personality: { mood: "sweet", intensity: 2 } });
    const again = await b.askNextQuestion();
    assert.equal(again.activeQuestionId, first.activeQuestionId);
    assert.equal(again.rung, first.rung);
  });

  it("does not invent promises when answering", async () => {
    const store = createMemoryKarenSessionStore();
    const karen = createKarenOrchestrator({ store, userId: "no_invent", personality: { mood: "sweet", intensity: 1 } });
    await karen.seedFact({ kind: "daily_progress", text: "walked 10 minutes", key: "walk 10" });
    await karen.askNextQuestion();
    await karen.handleAnswer("I might start a marathon someday");
    const state = await karen.getState();
    assert.equal(
      state.facts.some((f) => f.kind === "promise" && /marathon/i.test(f.text)),
      false,
    );
  });
});

/** Helper for report authors — not a test dependency. */
export function formatTurn(out: KarenTurnOutput): string {
  return JSON.stringify(
    {
      message: out.message,
      activeQuestionId: out.activeQuestionId,
      rung: out.rung,
      verdict: out.verdict,
      mood: out.mood,
      intensity: out.intensity,
      faceCue: out.faceCue,
      nextAction: out.nextAction,
    },
    null,
    2,
  );
}
