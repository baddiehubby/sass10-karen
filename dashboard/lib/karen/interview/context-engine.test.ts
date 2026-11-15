import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  categoriesWithEvidence,
  ingestLifeContext,
  isConfirmedFactSource,
  KAREN_PROBE_CATEGORIES,
} from "@/lib/karen/interview/context-engine";
import {
  createMemoryKarenSessionStore,
  loadOrCreateInterviewState,
  recordLifeFact,
  recordTurn,
  saveInterviewState,
} from "@/lib/karen/interview/session-memory";
import { createEmptyInterviewState } from "@/lib/karen/interview/types";

describe("Karen context-engine — Stage 2", () => {
  it("exposes all nine life-probe categories", () => {
    assert.equal(KAREN_PROBE_CATEGORIES.length, 9);
    assert.deepEqual([...KAREN_PROBE_CATEGORIES], [
      "commitment",
      "tradeoff",
      "failure_mode",
      "habit_ceiling",
      "day_flow",
      "avoidance",
      "glossed_struggle",
      "excuse_pattern",
      "value_skepticism",
    ]);
  });

  it("marks thin context when there are no confirmed facts", () => {
    const state = createEmptyInterviewState("user_thin");
    state.recentTurns = [
      { at: "1", role: "user", text: "I might go to the gym someday" },
      { at: "2", role: "karen", text: "Might?" },
    ];
    const ctx = ingestLifeContext(state);
    assert.equal(ctx.thinContext, true);
    assert.equal(ctx.openPromises.length, 0);
    assert.equal(ctx.inventedNothing, true);
    assert.equal(ctx.recentUserUtterances.length, 1);
    assert.ok(categoriesWithEvidence(ctx).length === 0);
  });

  it("ingests only recorded session facts — never invents a promise from chatter", () => {
    let state = createEmptyInterviewState("user_chat");
    state = recordTurn(state, {
      role: "user",
      text: "I should probably start running",
      at: "2026-11-15T08:00:00.000Z",
    });
    const ctx = ingestLifeContext(state);
    assert.equal(ctx.openPromises.length, 0);
    assert.equal(ctx.goals.length, 0);
    assert.equal(ctx.thinContext, true);
    assert.equal(isConfirmedFactSource("utterance"), false);
    assert.equal(isConfirmedFactSource("fact"), true);
  });

  it("surfaces open promises, repeated excuses, and goals from confirmed facts", () => {
    let state = createEmptyInterviewState("user_rich");
    state = recordLifeFact(state, {
      kind: "promise",
      text: "go to the gym every weekday",
      key: "gym weekday",
    });
    state = recordLifeFact(state, {
      kind: "excuse",
      text: "I was busy",
      key: "i was busy",
    });
    state = recordLifeFact(state, {
      kind: "excuse",
      text: "I was busy",
      key: "i was busy",
    });
    state = recordLifeFact(state, {
      kind: "goal",
      text: "ship portfolio by Friday",
      key: "portfolio friday",
    });
    state = recordLifeFact(state, {
      kind: "avoidance",
      text: "skipped deep work for Netflix",
      key: "netflix skip",
    });
    state = recordLifeFact(state, {
      kind: "daily_progress",
      text: "0 deep work hours",
      key: "2026-11-15 deep work",
    });

    const ctx = ingestLifeContext(state);
    assert.equal(ctx.thinContext, false);
    assert.equal(ctx.openPromises.length, 1);
    assert.equal(ctx.repeatedExcuses.length, 1);
    assert.equal(ctx.repeatedExcuses[0]!.timesSeen, 2);
    assert.equal(ctx.goals.length, 1);
    assert.ok(ctx.categoryEvidence.commitment >= 1);
    assert.ok(ctx.categoryEvidence.excuse_pattern >= 2);
    assert.ok(categoriesWithEvidence(ctx).includes("commitment"));
    assert.ok(categoriesWithEvidence(ctx).includes("excuse_pattern"));
  });

  it("does not treat completed promises as open", () => {
    let state = createEmptyInterviewState("user_done");
    state = recordLifeFact(state, { kind: "promise", text: "finish report", key: "finish report" });
    state = recordLifeFact(state, {
      kind: "completion",
      text: "finished report",
      key: "finish report",
    });
    const ctx = ingestLifeContext(state);
    assert.equal(ctx.openPromises.length, 0);
    assert.equal(ctx.completions.length, 1);
  });

  it("keeps users isolated when ingesting from the session store", async () => {
    const store = createMemoryKarenSessionStore();
    let a = await loadOrCreateInterviewState(store, "alpha");
    a = recordLifeFact(a, { kind: "promise", text: "alpha gym", key: "alpha gym" });
    await saveInterviewState(store, a);

    let b = await loadOrCreateInterviewState(store, "beta");
    b = recordLifeFact(b, { kind: "excuse", text: "beta busy", key: "beta busy" });
    await saveInterviewState(store, b);

    const ctxA = ingestLifeContext(await loadOrCreateInterviewState(store, "alpha"));
    const ctxB = ingestLifeContext(await loadOrCreateInterviewState(store, "beta"));
    assert.equal(ctxA.openPromises[0]?.key, "alpha gym");
    assert.equal(ctxA.excuses.length, 0);
    assert.equal(ctxB.openPromises.length, 0);
    assert.equal(ctxB.excuses[0]?.key, "beta busy");
    assert.equal(ctxA.userId, "alpha");
    assert.equal(ctxB.userId, "beta");
  });
});
