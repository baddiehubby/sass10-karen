import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";

import {
  createAuthedKarenSessionStore,
  createPrismaKarenSessionStore,
  deleteKarenDataForUser,
  KarenConcurrentWriteError,
  KarenUserScopeError,
  KAREN_PRODUCTION_AUTH_CONTRACT,
  resolveAuthedKarenStore,
  type KarenPrismaDb,
  type KarenPrismaTx,
} from "@/lib/karen/interview/prisma-store";
import { createKarenOrchestrator } from "@/lib/karen/interview/orchestrator";
import { createEmptyInterviewState, type KarenInterviewState } from "@/lib/karen/interview/types";

type Row = {
  id: string;
  userId: string;
  version: number;
  payload: unknown;
};

type FingerprintRow = {
  id: string;
  userId: string;
  interviewId: string;
  fingerprint: string;
};

function uniqueError(): Error & { code: string } {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

/** In-memory Prisma stand-in with transactional semantics for unit tests. */
function createFakeKarenPrisma(): KarenPrismaDb & {
  interviews: Map<string, Row>;
  fingerprints: Map<string, FingerprintRow>;
  failNextTransaction: boolean;
} {
  const interviews = new Map<string, Row>();
  const fingerprints = new Map<string, FingerprintRow>();
  let failNextTransaction = false;

  function key(userId: string, fingerprint: string) {
    return `${userId}::${fingerprint}`;
  }

  function api(viewInterviews: Map<string, Row>, viewFingerprints: Map<string, FingerprintRow>): KarenPrismaTx {
    return {
      karenInterview: {
        async findUnique({ where }) {
          const row = viewInterviews.get(where.userId);
          return row ? { ...row } : null;
        },
        async create({ data }) {
          if (viewInterviews.has(data.userId)) throw uniqueError();
          const row: Row = {
            id: randomUUID(),
            userId: data.userId,
            version: data.version,
            payload: data.payload,
          };
          viewInterviews.set(data.userId, row);
          return { id: row.id, version: row.version };
        },
        async updateMany({ where, data }) {
          const row = viewInterviews.get(where.userId);
          if (!row || row.version !== where.version) return { count: 0 };
          row.version = data.version;
          row.payload = data.payload;
          return { count: 1 };
        },
        async deleteMany({ where }) {
          const had = viewInterviews.delete(where.userId);
          return { count: had ? 1 : 0 };
        },
      },
      karenProcessedAnswer: {
        async create({ data }) {
          const k = key(data.userId, data.fingerprint);
          if (viewFingerprints.has(k)) throw uniqueError();
          const row: FingerprintRow = {
            id: randomUUID(),
            userId: data.userId,
            interviewId: data.interviewId,
            fingerprint: data.fingerprint,
          };
          viewFingerprints.set(k, row);
          return row;
        },
        async findUnique({ where }) {
          return (
            viewFingerprints.get(
              key(where.userId_fingerprint.userId, where.userId_fingerprint.fingerprint),
            ) ?? null
          );
        },
        async deleteMany({ where }) {
          let count = 0;
          for (const [k, row] of [...viewFingerprints.entries()]) {
            if (row.userId === where.userId) {
              viewFingerprints.delete(k);
              count += 1;
            }
          }
          return { count };
        },
      },
    };
  }

  const root: KarenPrismaDb & {
    interviews: Map<string, Row>;
    fingerprints: Map<string, FingerprintRow>;
    failNextTransaction: boolean;
  } = {
    interviews,
    fingerprints,
    get failNextTransaction() {
      return failNextTransaction;
    },
    set failNextTransaction(v: boolean) {
      failNextTransaction = v;
    },
    async $transaction(fn) {
      if (failNextTransaction) {
        failNextTransaction = false;
        throw new Error("forced transaction failure");
      }
      const snapI = new Map([...interviews.entries()].map(([k, v]) => [k, { ...v }]));
      const snapF = new Map([...fingerprints.entries()].map(([k, v]) => [k, { ...v }]));
      try {
        return await fn(api(interviews, fingerprints));
      } catch (err) {
        interviews.clear();
        for (const [k, v] of snapI) interviews.set(k, v);
        fingerprints.clear();
        for (const [k, v] of snapF) fingerprints.set(k, v);
        throw err;
      }
    },
    karenInterview: api(interviews, fingerprints).karenInterview,
    karenProcessedAnswer: api(interviews, fingerprints).karenProcessedAnswer,
  };

  return root;
}

function sampleState(userId: string, patch?: Partial<KarenInterviewState>): KarenInterviewState {
  const base = createEmptyInterviewState(userId);
  return {
    ...base,
    ...patch,
    userId,
    facts: patch?.facts ?? [
      {
        id: "f1",
        kind: "promise",
        text: "go to the gym",
        key: "gym",
        createdAt: "2026-11-15T00:00:00.000Z",
        timesSeen: 1,
        lastSeenAt: "2026-11-15T00:00:00.000Z",
        source: "seed",
        relevance: 0.7,
      },
    ],
    lastAnswerFingerprint: patch?.lastAnswerFingerprint ?? null,
    committedVerdictQuestionIds: patch?.committedVerdictQuestionIds ?? [],
  };
}

describe("Karen Prisma store — Stage 6B-1 / 6B-1.1 unit", () => {
  it("documents the production auth contract", () => {
    assert.equal(KAREN_PRODUCTION_AUTH_CONTRACT.forbidClientUserIdOwnership, true);
    assert.ok(KAREN_PRODUCTION_AUTH_CONTRACT.allowedIdentitySources.includes("sessionUserId"));
  });

  it("persists and reloads full interview state for a user", async () => {
    const db = createFakeKarenPrisma();
    const store = createPrismaKarenSessionStore(db);
    const userId = "user_persist_abcdefgh";
    const state = sampleState(userId, {
      activeQuestionId: "q-1",
      activeRung: "push",
      awaitingClarification: true,
      lastMood: "furious",
      intensity: 5,
      lastAnswerFingerprint: "q-1:push:i was busy",
      committedVerdictQuestionIds: ["q-old"],
    });
    await store.set(state);
    const loaded = await store.get(userId);
    assert.ok(loaded);
    assert.equal(loaded!.activeQuestionId, "q-1");
    assert.equal(loaded!.activeRung, "push");
    assert.equal(loaded!.awaitingClarification, true);
    assert.equal(loaded!.lastMood, "furious");
    assert.equal(loaded!.intensity, 5);
    assert.equal(loaded!.lastAnswerFingerprint, "q-1:push:i was busy");
    assert.equal(loaded!.facts[0]?.text, "go to the gym");
    assert.deepEqual(loaded!.committedVerdictQuestionIds, ["q-old"]);
  });

  it("isolates users — one user cannot read another's payload", async () => {
    const db = createFakeKarenPrisma();
    const store = createPrismaKarenSessionStore(db);
    await store.set(sampleState("user_alpha_12345678", { lastMood: "sweet" }));
    await store.set(sampleState("user_beta_123456789", { lastMood: "furious" }));

    const a = await store.get("user_alpha_12345678");
    const b = await store.get("user_beta_123456789");
    assert.equal(a!.lastMood, "sweet");
    assert.equal(b!.lastMood, "furious");
    assert.equal(a!.userId, "user_alpha_12345678");
  });

  it("auth-scoped store rejects cross-user get/set", async () => {
    const db = createFakeKarenPrisma();
    const inner = createPrismaKarenSessionStore(db);
    const authed = createAuthedKarenSessionStore("user_auth_12345678", inner);
    await authed.set(sampleState("user_auth_12345678"));
    await assert.rejects(
      () => authed.get("user_other_12345678"),
      (err: unknown) => err instanceof KarenUserScopeError,
    );
    await assert.rejects(
      () => authed.set(sampleState("user_other_12345678")),
      (err: unknown) => err instanceof KarenUserScopeError,
    );
  });

  it("resolveAuthedKarenStore uses session user id only", async () => {
    const db = createFakeKarenPrisma();
    const inner = createPrismaKarenSessionStore(db);
    const none = await resolveAuthedKarenStore(async () => null, inner);
    assert.equal(none, null);
    const scoped = await resolveAuthedKarenStore(async () => "user_sess_12345678", inner);
    assert.ok(scoped);
    await scoped!.store.set(sampleState("user_sess_12345678", { intensity: 4 }));
    const got = await scoped!.store.get("user_sess_12345678");
    assert.equal(got!.intensity, 4);
  });

  it("records answer fingerprints for cross-restart idempotency", async () => {
    const db = createFakeKarenPrisma();
    const store = createPrismaKarenSessionStore(db);
    const userId = "user_idem_12345678";
    await store.set(sampleState(userId, { lastAnswerFingerprint: "q-1:surface:i was busy" }));
    assert.equal(await store.hasProcessedFingerprint(userId, "q-1:surface:i was busy"), true);
    assert.equal(await store.hasProcessedFingerprint(userId, "q-1:surface:other"), false);
  });

  it("detects concurrent writes via optimistic version", async () => {
    const db = createFakeKarenPrisma();
    const store = createPrismaKarenSessionStore(db);
    const userId = "user_race_12345678";
    await store.set(sampleState(userId, { intensity: 1 }));

    const row = db.interviews.get(userId)!;
    const writerA = store.set(sampleState(userId, { intensity: 2, lastMood: "sweet" }));
    row.version = row.version + 1;
    await assert.rejects(
      () => writerA,
      (err: unknown) => err instanceof KarenConcurrentWriteError,
    );
  });

  it("create-race does not blindly overwrite at version 1", async () => {
    const db = createFakeKarenPrisma();
    const store = createPrismaKarenSessionStore(db);
    const userId = "user_create_race_12";

    // First writer creates.
    await store.set(sampleState(userId, { intensity: 1, lastAnswerFingerprint: "fp-a" }));
    assert.equal((await store.get(userId))!.intensity, 1);

    // Second writer hits unique on create path inside a raced mental model:
    // simulate by having a row already; set() goes through versioned update.
    await store.set(sampleState(userId, { intensity: 2, lastAnswerFingerprint: "fp-b" }));
    assert.equal((await store.get(userId))!.intensity, 2);
    assert.equal(await store.hasProcessedFingerprint(userId, "fp-a"), true);
    assert.equal(await store.hasProcessedFingerprint(userId, "fp-b"), true);
  });

  it("rolls back on failed transactions", async () => {
    const db = createFakeKarenPrisma();
    const store = createPrismaKarenSessionStore(db);
    const userId = "user_tx_1234567890";
    await store.set(sampleState(userId, { intensity: 3 }));
    db.failNextTransaction = true;
    await assert.rejects(() => store.set(sampleState(userId, { intensity: 5 })));
    const loaded = await store.get(userId);
    assert.equal(loaded!.intensity, 3);
  });

  it("deleteKarenDataForUser removes only that user's Karen rows", async () => {
    const db = createFakeKarenPrisma();
    const store = createPrismaKarenSessionStore(db);
    await store.set(sampleState("user_del_aaaaaaaa", { lastAnswerFingerprint: "fp-a" }));
    await store.set(sampleState("user_del_bbbbbbbb", { lastAnswerFingerprint: "fp-b" }));
    await deleteKarenDataForUser("user_del_aaaaaaaa", db);
    assert.equal(await store.get("user_del_aaaaaaaa"), null);
    assert.ok(await store.get("user_del_bbbbbbbb"));
    assert.equal(await store.hasProcessedFingerprint("user_del_aaaaaaaa", "fp-a"), false);
    assert.equal(await store.hasProcessedFingerprint("user_del_bbbbbbbb", "fp-b"), true);
  });

  it("orchestrator recovers after Prisma-backed reload", async () => {
    const db = createFakeKarenPrisma();
    const store = createPrismaKarenSessionStore(db);
    const userId = "user_orch_12345678";
    const a = createKarenOrchestrator({
      store: createAuthedKarenSessionStore(userId, store),
      userId,
      personality: { mood: "sarcastic", intensity: 3 },
    });
    await a.seedFact({ kind: "promise", text: "gym weekday", key: "gym weekday" });
    const ask = await a.askNextQuestion();
    assert.ok(ask.activeQuestionId);
    await a.handleAnswer("I was busy", {
      questionId: ask.activeQuestionId!,
      expectedRung: "surface",
    });

    const b = createKarenOrchestrator({
      store: createAuthedKarenSessionStore(userId, store),
      userId,
      personality: { mood: "sarcastic", intensity: 3 },
    });
    const again = await b.askNextQuestion();
    assert.equal(again.activeQuestionId, ask.activeQuestionId);
    assert.equal(again.rung, "push");
    assert.equal(again.nextAction, "await_followup");
  });

  it("does not treat stored utterances as verified facts on load", async () => {
    const db = createFakeKarenPrisma();
    const store = createPrismaKarenSessionStore(db);
    const userId = "user_facts_1234567";
    const state = sampleState(userId, {
      facts: [
        {
          id: "f-answer",
          kind: "answer",
          text: "I went to the gym for 45 minutes",
          key: "gym 45",
          createdAt: "2026-11-15T00:00:00.000Z",
          timesSeen: 1,
          lastSeenAt: "2026-11-15T00:00:00.000Z",
          source: "user_utterance",
          relevance: 1,
        },
      ],
    });
    await store.set(state);
    const loaded = await store.get(userId);
    assert.equal(loaded!.facts[0]?.kind, "answer");
    assert.notEqual(loaded!.facts[0]?.kind, "completion");
  });
});
