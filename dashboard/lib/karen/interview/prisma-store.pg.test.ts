/**
 * Real PostgreSQL integration tests for Karen persistence (Stage 6B-1.1).
 *
 * Requires:
 *   KAREN_TEST_DATABASE_URL=postgresql://...
 * Optionally start: docker compose -f docker-compose.karen-test.yml up -d
 *
 * When the env var is missing, the suite skips (CI without Postgres stays green).
 */

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { PrismaClient, Prisma } from "@prisma/client";

import {
  createAuthedKarenSessionStore,
  createPrismaKarenSessionStore,
  deleteKarenDataForUser,
  KarenConcurrentWriteError,
} from "@/lib/karen/interview/prisma-store";
import { createEmptyInterviewState, type KarenInterviewState } from "@/lib/karen/interview/types";

const TEST_URL = process.env.KAREN_TEST_DATABASE_URL || "";
const ENABLED = Boolean(TEST_URL && !TEST_URL.includes("YOUR_VALUE"));

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
        createdAt: new Date().toISOString(),
        timesSeen: 1,
        lastSeenAt: new Date().toISOString(),
        source: "seed",
        relevance: 0.7,
      },
    ],
  };
}

/** Apply proposed Karen SQL in statement-sized chunks (Postgres via Prisma). */
async function applyKarenSql(prisma: PrismaClient): Promise<void> {
  const sqlPath = path.join(
    process.cwd(),
    "prisma",
    "proposed-migrations",
    "add_karen_interview_persistence.sql",
  );
  const raw = readFileSync(sqlPath, "utf8");
  // Split on semicolons that end statements, keeping DO $$ ... $$ blocks intact.
  const chunks: string[] = [];
  let buf = "";
  let inDo = false;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!inDo && trimmed.startsWith("--")) continue;
    if (!inDo && trimmed.startsWith("DO $$")) inDo = true;
    buf += `${line}\n`;
    if (inDo && trimmed.endsWith("$$;")) {
      chunks.push(buf.trim());
      buf = "";
      inDo = false;
    } else if (!inDo && trimmed.endsWith(";") && !trimmed.startsWith("--")) {
      chunks.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) chunks.push(buf.trim());

  for (const chunk of chunks) {
    if (!chunk || chunk.startsWith("--")) continue;
    await prisma.$executeRawUnsafe(chunk);
  }
}

describe("Karen Prisma store — PostgreSQL integration (6B-1.1)", { skip: !ENABLED }, () => {
  let prisma: PrismaClient;
  const suffix = createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 8);
  const userA = `karen_pg_a_${suffix}`;
  const userB = `karen_pg_b_${suffix}`;

  before(async () => {
    // Push full Prisma schema so User (+ Karen) exist on a blank test DB.
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      env: { ...process.env, DATABASE_URL: TEST_URL },
      stdio: "inherit",
      cwd: process.cwd(),
    });

    prisma = new PrismaClient({
      datasources: { db: { url: TEST_URL } },
      log: ["error"],
    });
    await prisma.$connect();

    // Also exercise the proposed SQL path (idempotent on already-pushed schema).
    await applyKarenSql(prisma);

    for (const id of [userA, userB]) {
      await prisma.user.upsert({
        where: { id },
        create: {
          id,
          email: `${id}@karen.test`,
          password: "test-only-not-a-real-hash",
          name: "Karen PG Test",
        },
        update: {},
      });
    }
  });

  after(async () => {
    try {
      await deleteKarenDataForUser(userA, prisma as never);
      await deleteKarenDataForUser(userB, prisma as never);
      await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("persists and reloads a complete Karen session", async () => {
    const store = createPrismaKarenSessionStore(prisma as never);
    const state = sampleState(userA, {
      activeQuestionId: "q-1",
      activeRung: "floor",
      awaitingClarification: true,
      lastMood: "annoyed",
      intensity: 4,
      lastAnswerFingerprint: `q-1:floor:busy-${suffix}`,
      committedVerdictQuestionIds: ["q-prev"],
      recentTurns: [
        {
          at: new Date().toISOString(),
          role: "user",
          text: "I was busy",
          questionId: "q-1",
          rung: "floor",
        },
      ],
    });
    await store.set(state);
    const loaded = await store.get(userA);
    assert.ok(loaded);
    assert.equal(loaded!.activeQuestionId, "q-1");
    assert.equal(loaded!.activeRung, "floor");
    assert.equal(loaded!.awaitingClarification, true);
    assert.equal(loaded!.lastMood, "annoyed");
    assert.equal(loaded!.facts[0]?.kind, "promise");
    assert.equal(loaded!.recentTurns[0]?.text, "I was busy");
    assert.ok(await store.hasProcessedFingerprint(userA, state.lastAnswerFingerprint!));
    assert.ok(await store.hasProcessedFingerprint(userA, "verdict:q-prev"));
  });

  it("isolates two users across separate connections", async () => {
    const prisma2 = new PrismaClient({
      datasources: { db: { url: TEST_URL } },
      log: ["error"],
    });
    try {
      const store1 = createPrismaKarenSessionStore(prisma as never);
      const store2 = createPrismaKarenSessionStore(prisma2 as never);
      await store1.set(sampleState(userA, { lastMood: "sweet", intensity: 1 }));
      await store2.set(sampleState(userB, { lastMood: "furious", intensity: 5 }));

      const a = await store2.get(userA);
      const b = await store1.get(userB);
      assert.equal(a!.lastMood, "sweet");
      assert.equal(b!.lastMood, "furious");

      const authedA = createAuthedKarenSessionStore(userA, store1);
      await assert.rejects(() => authedA.get(userB));
      await assert.rejects(() => authedA.set(sampleState(userB)));
    } finally {
      await prisma2.$disconnect();
    }
  });

  it("rejects concurrent conflicting version writes", async () => {
    const store = createPrismaKarenSessionStore(prisma as never);
    await store.set(sampleState(userA, { intensity: 1, lastAnswerFingerprint: null }));

    const write1 = store.set(
      sampleState(userA, { intensity: 2, lastAnswerFingerprint: `race-a-${randomUUID()}` }),
    );
    const write2 = store.set(
      sampleState(userA, { intensity: 3, lastAnswerFingerprint: `race-b-${randomUUID()}` }),
    );

    const results = await Promise.allSettled([write1, write2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.ok(fulfilled.length >= 1, "at least one writer commits");
    if (rejected.length) {
      const ok = rejected.some((r) => {
        if (r.status !== "rejected") return false;
        const reason = r.reason as { message?: string; code?: string; name?: string };
        return (
          reason instanceof KarenConcurrentWriteError ||
          reason?.name === "KarenConcurrentWriteError" ||
          String(reason?.message || reason).includes("could not serialize") ||
          String(reason?.code || "").startsWith("P")
        );
      });
      assert.ok(ok, "rejected writer should be concurrent/serialize error");
    }
    const final = await store.get(userA);
    assert.ok(final!.intensity === 2 || final!.intensity === 3);
  });

  it("cannot double-insert the same fingerprint under concurrent claims", async () => {
    const fp = `same-answer-${suffix}-${randomUUID()}`;
    const store = createPrismaKarenSessionStore(prisma as never);
    await store.set(sampleState(userA, { intensity: 1, lastAnswerFingerprint: null }));

    const a = store.set(sampleState(userA, { intensity: 2, lastAnswerFingerprint: fp }));
    const b = store.set(sampleState(userA, { intensity: 2, lastAnswerFingerprint: fp }));
    await Promise.allSettled([a, b]);

    const rows = await prisma.karenProcessedAnswer.findMany({
      where: { userId: userA, fingerprint: fp },
    });
    assert.equal(rows.length, 1, "unique (userId, fingerprint) allows exactly one row");
  });

  it("keeps duplicate fingerprints idempotent across connections", async () => {
    const fp = `dup-fp-${suffix}`;
    const store1 = createPrismaKarenSessionStore(prisma as never);
    await store1.set(sampleState(userA, { lastAnswerFingerprint: fp, intensity: 2 }));

    const prisma2 = new PrismaClient({
      datasources: { db: { url: TEST_URL } },
      log: ["error"],
    });
    try {
      const store2 = createPrismaKarenSessionStore(prisma2 as never);
      assert.equal(await store2.hasProcessedFingerprint(userA, fp), true);
      await store2.set(sampleState(userA, { lastAnswerFingerprint: fp, intensity: 2 }));
      assert.equal(await store1.hasProcessedFingerprint(userA, fp), true);
      const rows = await prisma.karenProcessedAnswer.findMany({
        where: { userId: userA, fingerprint: fp },
      });
      assert.equal(rows.length, 1);
    } finally {
      await prisma2.$disconnect();
    }
  });

  it("rolls back partial writes when the transaction fails mid-flight", async () => {
    const store = createPrismaKarenSessionStore(prisma as never);
    await store.set(sampleState(userA, { intensity: 3, lastAnswerFingerprint: `stable-${suffix}` }));

    const before = await prisma.karenInterview.findUnique({ where: { userId: userA } });
    assert.ok(before);

    await assert.rejects(async () => {
      await prisma.$transaction(
        async (tx) => {
          await tx.karenInterview.updateMany({
            where: { userId: userA, version: before!.version },
            data: {
              version: before!.version + 1,
              payload: sampleState(userA, {
                intensity: 5,
                lastAnswerFingerprint: `boom-${suffix}`,
              }) as never,
            },
          });
          await tx.karenProcessedAnswer.create({
            data: {
              id: randomUUID(),
              userId: userA,
              interviewId: before!.id,
              fingerprint: `boom-${suffix}`,
            },
          });
          throw new Error("forced failure after interview + fingerprint writes");
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    });

    const after = await prisma.karenInterview.findUnique({ where: { userId: userA } });
    assert.equal(after!.version, before!.version);
    const payload = after!.payload as { intensity?: number };
    assert.equal(payload.intensity, 3);
    assert.equal(await store.hasProcessedFingerprint(userA, `boom-${suffix}`), false);
  });

  it("deletes all Karen records for a user without touching the other user", async () => {
    const store = createPrismaKarenSessionStore(prisma as never);
    await store.set(sampleState(userA, { lastAnswerFingerprint: `del-a-${suffix}` }));
    await store.set(sampleState(userB, { lastAnswerFingerprint: `del-b-${suffix}` }));
    await deleteKarenDataForUser(userA, prisma as never);
    assert.equal(await store.get(userA), null);
    assert.equal(await store.hasProcessedFingerprint(userA, `del-a-${suffix}`), false);
    assert.ok(await store.get(userB));
    assert.equal(await store.hasProcessedFingerprint(userB, `del-b-${suffix}`), true);
  });
});

describe("Karen Prisma store — PostgreSQL gate", () => {
  it("reports whether live PG tests ran", () => {
    if (!ENABLED) {
      console.log(
        "[karen-pg] SKIPPED: set KAREN_TEST_DATABASE_URL to run real PostgreSQL integration tests. Optional: docker compose -f docker-compose.karen-test.yml up -d",
      );
    } else {
      console.log("[karen-pg] ENABLED against KAREN_TEST_DATABASE_URL");
    }
    assert.ok(true);
  });
});
