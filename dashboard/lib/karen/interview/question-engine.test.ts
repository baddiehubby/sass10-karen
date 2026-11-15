import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ingestLifeContext } from "@/lib/karen/interview/context-engine";
import {
  assertNineCategoryTaxonomy,
  bankIsContextGrounded,
  buildProbeBank,
  generateProbeCandidates,
  isDuplicateProbe,
  orderedBank,
  passesRankThreshold,
  scoreAxesForFact,
  selectNextQuestion,
  sumRankAxes,
} from "@/lib/karen/interview/question-engine";
import {
  createMemoryKarenSessionStore,
  loadOrCreateInterviewState,
  recordLifeFact,
  replaceQuestionBank,
  saveInterviewState,
  setActiveProbe,
} from "@/lib/karen/interview/session-memory";
import {
  createEmptyInterviewState,
  KAREN_RANK_DISCARD_BELOW,
  type KarenLifeFact,
  type KarenProbeQuestion,
  type KarenRankAxes,
} from "@/lib/karen/interview/types";

function fact(partial: Partial<KarenLifeFact> & Pick<KarenLifeFact, "kind" | "text" | "key">): KarenLifeFact {
  return {
    id: partial.id ?? `f_${partial.key}`,
    kind: partial.kind,
    text: partial.text,
    key: partial.key,
    createdAt: partial.createdAt ?? "2026-11-15T00:00:00.000Z",
    timesSeen: partial.timesSeen ?? 1,
    lastSeenAt: partial.lastSeenAt ?? "2026-11-15T00:00:00.000Z",
  };
}

function lowAxes(): KarenRankAxes {
  return { loadBearing: 2, interviewerLikelihood: 2, nonObviousness: 2 };
}

describe("Karen question-engine — Stage 2", () => {
  it("keeps the nine-category taxonomy intact", () => {
    assert.equal(assertNineCategoryTaxonomy().length, 9);
  });

  it("discards probes scoring below 9", () => {
    assert.equal(sumRankAxes(lowAxes()), 6);
    assert.equal(passesRankThreshold(lowAxes()), false);
    assert.equal(
      passesRankThreshold({ loadBearing: 3, interviewerLikelihood: 3, nonObviousness: 3 }),
      true,
    );
    assert.equal(KAREN_RANK_DISCARD_BELOW, 9);
  });

  it("ranks commitment and repeated-excuse probes above the discard floor", () => {
    let state = createEmptyInterviewState("rank_user");
    state = {
      ...state,
      facts: [
        fact({ kind: "promise", text: "gym daily", key: "gym daily" }),
        fact({ kind: "excuse", text: "I was busy", key: "i was busy", timesSeen: 3 }),
      ],
    };
    const ctx = ingestLifeContext(state);
    const promise = ctx.openPromises[0]!;
    const excuse = ctx.repeatedExcuses[0]!;
    const commitmentAxes = scoreAxesForFact("commitment", promise, ctx);
    const excuseAxes = scoreAxesForFact("excuse_pattern", excuse, ctx);
    assert.ok(sumRankAxes(commitmentAxes) >= 9);
    assert.ok(sumRankAxes(excuseAxes) >= 9);
    assert.ok(excuseAxes.nonObviousness >= commitmentAxes.nonObviousness);
  });

  it("returns no fresh candidates when context is missing", () => {
    const state = createEmptyInterviewState("empty");
    const ctx = ingestLifeContext(state);
    assert.equal(ctx.thinContext, true);
    assert.deepEqual(generateProbeCandidates(ctx), []);
    assert.deepEqual(buildProbeBank(state), []);
  });

  it("builds contextual questions that cite confirmed facts — not generic motivation", () => {
    let state = createEmptyInterviewState("specific");
    state = recordLifeFact(state, {
      kind: "promise",
      text: "finish the portfolio landing page",
      key: "portfolio landing",
    });
    state = recordLifeFact(state, {
      kind: "excuse",
      text: "I was busy",
      key: "i was busy",
      // second sighting
    });
    state = recordLifeFact(state, {
      kind: "excuse",
      text: "I was busy",
      key: "i was busy",
    });

    const bank = buildProbeBank(state, { mode: "default" });
    assert.ok(bank.length > 0);
    assert.ok(bank.every((q) => sumRankAxes(q.axes ?? lowAxes()) >= 9 || q.rankScore >= 9));
    assert.ok(bank.some((q) => /portfolio landing page/i.test(q.question)));
    assert.ok(bank.some((q) => /busy/i.test(q.question)));
    assert.equal(
      bank.some((q) => /believe in yourself|stay positive|you got this|how are you motivating/i.test(q.question)),
      false,
    );
    assert.equal(bankIsContextGrounded(bank, ingestLifeContext(state)), true);
  });

  it("filters duplicate questions and anchors", () => {
    const existing: KarenProbeQuestion[] = [
      {
        id: "q1",
        category: "commitment",
        entry: "x",
        question: "Did you go to the gym?",
        anchor: "promise:gym",
        evidence: "e",
        push: "p",
        floor: "f",
        rankScore: 12,
        status: "queued",
        timesAsked: 0,
        bestScore: null,
      },
    ];
    assert.equal(
      isDuplicateProbe({ question: "Did you go to the gym?", anchor: "other", category: "tradeoff" }, existing),
      true,
    );
    assert.equal(
      isDuplicateProbe({ question: "Something else?", anchor: "promise:gym", category: "commitment" }, existing),
      true,
    );
    assert.equal(
      isDuplicateProbe({ question: "Something else?", anchor: "promise:run", category: "commitment" }, existing),
      false,
    );
  });

  it("gives requeued weak questions priority over newly generated ones", () => {
    let state = createEmptyInterviewState("requeue_user");
    state = recordLifeFact(state, {
      kind: "promise",
      text: "write for one hour",
      key: "write one hour",
    });
    state = recordLifeFact(state, {
      kind: "goal",
      text: "ship v1",
      key: "ship v1",
    });

    const weak: KarenProbeQuestion = {
      id: "q-weak",
      category: "excuse_pattern",
      entry: "prior miss",
      question: "Last time you hid behind 'busy' — what was the real block?",
      anchor: "excuse:i was busy",
      evidence: "prior failed defense",
      push: "Be specific.",
      floor: "Timeline.",
      rankScore: 10,
      status: "requeued",
      timesAsked: 1,
      bestScore: "failed",
    };
    state = replaceQuestionBank(state, [weak]);

    const bank = buildProbeBank(state, { mode: "quick" });
    assert.equal(bank[0]!.id, "q-weak");
    assert.equal(bank[0]!.status, "requeued");
    assert.ok(orderedBank(bank)[0]!.status === "requeued");
    const next = selectNextQuestion({ ...state, questions: bank, activeQuestionId: null });
    assert.equal(next?.id, "q-weak");
  });

  it("preserves one-question-at-a-time via activeQuestionId", () => {
    let state = createEmptyInterviewState("one_q");
    state = recordLifeFact(state, { kind: "promise", text: "call mom", key: "call mom" });
    const bank = buildProbeBank(state);
    assert.ok(bank.length >= 1);
    state = replaceQuestionBank(state, bank);
    const first = selectNextQuestion(state);
    assert.ok(first);
    state = setActiveProbe(state, first!.id, "surface");
    const again = selectNextQuestion(state);
    assert.equal(again?.id, first!.id);
  });

  it("does not pad the bank with fillers when evidence is scarce", () => {
    let state = createEmptyInterviewState("scarce");
    state = recordLifeFact(state, {
      kind: "daily_progress",
      text: "walked 10 minutes",
      key: "walk 10",
    });
    const bank = buildProbeBank(state, { mode: "deep" });
    assert.ok(bank.length > 0);
    assert.ok(bank.length <= 12);
    // Every probe must reference the confirmed progress somehow via evidence/anchor.
    assert.ok(bank.every((q) => q.evidence.includes("confirmed") || q.status === "requeued"));
  });

  it("keeps probe banks isolated per user", async () => {
    const store = createMemoryKarenSessionStore();
    let a = await loadOrCreateInterviewState(store, "user_a");
    a = recordLifeFact(a, { kind: "promise", text: "alpha only task", key: "alpha only task" });
    const bankA = buildProbeBank(a);
    a = replaceQuestionBank(a, bankA);
    await saveInterviewState(store, a);

    let b = await loadOrCreateInterviewState(store, "user_b");
    b = recordLifeFact(b, { kind: "excuse", text: "beta traffic", key: "beta traffic" });
    b = recordLifeFact(b, { kind: "excuse", text: "beta traffic", key: "beta traffic" });
    const bankB = buildProbeBank(b);

    assert.ok(bankA.some((q) => /alpha only task/i.test(q.question)));
    assert.equal(bankA.some((q) => /beta traffic/i.test(q.question)), false);
    assert.ok(bankB.some((q) => /beta traffic/i.test(q.question)));
    assert.equal(bankB.some((q) => /alpha only task/i.test(q.question)), false);
  });

  it("drops below-threshold candidates even if generated", () => {
    const axes = { loadBearing: 1 as const, interviewerLikelihood: 2 as const, nonObviousness: 2 as const };
    assert.equal(passesRankThreshold(axes), false);
    let state = createEmptyInterviewState("threshold");
    // Zero evidence path: scoreAxesForFact collapses to 1+1+1 when categoryEvidence is 0.
    const emptyCtx = ingestLifeContext(state);
    const collapsed = scoreAxesForFact(
      "commitment",
      fact({ kind: "promise", text: "x", key: "x" }),
      emptyCtx,
    );
    assert.equal(sumRankAxes(collapsed), 3);
    assert.equal(passesRankThreshold(collapsed), false);
  });
});
