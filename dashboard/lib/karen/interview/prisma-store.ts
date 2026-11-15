/**
 * Karen production persistence — Prisma adapter for KarenSessionStore.
 * Separate from Buddy MemoryFragment. Additive schema only (Stage 6B-1 / 6B-1.1).
 */

import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  createEmptyInterviewState,
  type KarenInterviewState,
} from "@/lib/karen/interview/types";
import type { KarenSessionStore } from "@/lib/karen/interview/session-memory";

export class KarenConcurrentWriteError extends Error {
  readonly code = "KAREN_CONCURRENT_WRITE";
  constructor(userId: string) {
    super(`Concurrent Karen write for user ${userId}`);
    this.name = "KarenConcurrentWriteError";
  }
}

export class KarenUserScopeError extends Error {
  readonly code = "KAREN_USER_SCOPE";
  constructor(message: string) {
    super(message);
    this.name = "KarenUserScopeError";
  }
}

/** Minimal Prisma surface used by the store (injectable for tests). */
export type KarenPrismaDb = {
  $transaction<T>(
    fn: (tx: KarenPrismaTx) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
  karenInterview: {
    findUnique(args: {
      where: { userId: string };
      select?: { id?: boolean; version?: boolean; payload?: boolean; userId?: boolean };
    }): Promise<{ id: string; version: number; payload: unknown; userId: string } | null>;
    create(args: {
      data: { userId: string; version: number; payload: Prisma.InputJsonValue };
    }): Promise<{ id: string; version: number }>;
    updateMany(args: {
      where: { userId: string; version: number };
      data: { version: number; payload: Prisma.InputJsonValue };
    }): Promise<{ count: number }>;
    deleteMany(args: { where: { userId: string } }): Promise<{ count: number }>;
  };
  karenProcessedAnswer: {
    create(args: {
      data: { userId: string; interviewId: string; fingerprint: string };
    }): Promise<unknown>;
    findUnique(args: {
      where: { userId_fingerprint: { userId: string; fingerprint: string } };
    }): Promise<{ id: string } | null>;
    deleteMany(args: { where: { userId: string } }): Promise<{ count: number }>;
  };
};

export type KarenPrismaTx = Omit<KarenPrismaDb, "$transaction">;

function asState(payload: unknown, userId: string): KarenInterviewState {
  if (!payload || typeof payload !== "object") {
    return createEmptyInterviewState(userId);
  }
  const raw = payload as Partial<KarenInterviewState>;
  const base = createEmptyInterviewState(userId);
  return {
    ...base,
    ...raw,
    userId, // always trust the scoped user id, never payload spoofing
    schemaVersion: 1,
    questions: Array.isArray(raw.questions) ? raw.questions : [],
    facts: Array.isArray(raw.facts) ? raw.facts : [],
    recentTurns: Array.isArray(raw.recentTurns) ? raw.recentTurns : [],
    committedVerdictQuestionIds: Array.isArray(raw.committedVerdictQuestionIds)
      ? raw.committedVerdictQuestionIds
      : [],
    scorecard: raw.scorecard ?? base.scorecard,
    lastAnswerFingerprint: raw.lastAnswerFingerprint ?? null,
    awaitingClarification: Boolean(raw.awaitingClarification),
    activeQuestionId: raw.activeQuestionId ?? null,
    activeRung: raw.activeRung ?? null,
  };
}

function toPayload(state: KarenInterviewState): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
}

function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return true;
  return Boolean(err && typeof err === "object" && (err as { code?: string }).code === "P2002");
}

/**
 * Prisma-backed KarenSessionStore.
 * Production callers MUST wrap with createAuthedKarenSessionStore / resolveAuthedKarenStore.
 */
export function createPrismaKarenSessionStore(
  db: KarenPrismaDb = defaultPrisma as unknown as KarenPrismaDb,
): KarenSessionStore & {
  hasProcessedFingerprint(userId: string, fingerprint: string): Promise<boolean>;
  deleteForUser(userId: string): Promise<void>;
} {
  return {
    async get(userId) {
      if (!userId || userId.length < 8) return null;
      const row = await db.karenInterview.findUnique({
        where: { userId },
        select: { payload: true, userId: true, version: true, id: true },
      });
      if (!row) return null;
      return asState(row.payload, userId);
    },

    async set(state) {
      const userId = state.userId;
      if (!userId || userId.length < 8) {
        throw new KarenUserScopeError("Refusing to persist Karen state without a scoped userId");
      }
      const safe: KarenInterviewState = { ...state, userId };
      const payload = toPayload(safe);

      // RepeatableRead: version compare + unique fingerprint claims stay atomic under concurrency.
      await db.$transaction(
        async (tx) => {
          await writeInterviewPayload(tx, userId, payload, safe);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },

    async hasProcessedFingerprint(userId, fingerprint) {
      if (!fingerprint) return false;
      const row = await db.karenProcessedAnswer.findUnique({
        where: { userId_fingerprint: { userId, fingerprint } },
      });
      return Boolean(row);
    },

    async deleteForUser(userId) {
      await deleteKarenDataForUser(userId, db);
    },
  };
}

/**
 * Atomic interview write + fingerprint claims.
 * - Create uses insert; P2002 races fall through to versioned update (never blind overwrite).
 * - Update uses updateMany WHERE version = expected (0 rows → ConcurrentWriteError → full rollback).
 * - Fingerprints use insert-ignore semantics (unique violation = already claimed, OK).
 */
async function writeInterviewPayload(
  tx: KarenPrismaTx,
  userId: string,
  payload: Prisma.InputJsonValue,
  safe: KarenInterviewState,
): Promise<void> {
  const existing = await tx.karenInterview.findUnique({
    where: { userId },
    select: { id: true, version: true },
  });

  let interviewId: string;

  if (!existing) {
    try {
      const created = await tx.karenInterview.create({
        data: { userId, version: 1, payload },
      });
      interviewId = created.id;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Lost create race — load winner and version-bump (no silent overwrite at version 0/1).
      const raced = await tx.karenInterview.findUnique({
        where: { userId },
        select: { id: true, version: true },
      });
      if (!raced) throw err;
      const nextVersion = raced.version + 1;
      const updated = await tx.karenInterview.updateMany({
        where: { userId, version: raced.version },
        data: { version: nextVersion, payload },
      });
      if (updated.count !== 1) {
        throw new KarenConcurrentWriteError(userId);
      }
      interviewId = raced.id;
    }
  } else {
    const nextVersion = existing.version + 1;
    const updated = await tx.karenInterview.updateMany({
      where: { userId, version: existing.version },
      data: { version: nextVersion, payload },
    });
    if (updated.count !== 1) {
      throw new KarenConcurrentWriteError(userId);
    }
    interviewId = existing.id;
  }

  await claimFingerprint(tx, userId, interviewId, safe.lastAnswerFingerprint);
  for (const qid of safe.committedVerdictQuestionIds.slice(-20)) {
    await claimFingerprint(tx, userId, interviewId, `verdict:${qid}`);
  }
}

async function claimFingerprint(
  tx: KarenPrismaTx,
  userId: string,
  interviewId: string,
  fingerprint: string | null,
): Promise<void> {
  if (!fingerprint) return;
  try {
    await tx.karenProcessedAnswer.create({
      data: { userId, interviewId, fingerprint },
    });
  } catch (err) {
    // Unique (userId, fingerprint) — already claimed; idempotent success inside the same tx.
    if (!isUniqueViolation(err)) throw err;
  }
}

/** GDPR / account deletion — Karen tables only (not Buddy memories). */
export async function deleteKarenDataForUser(
  userId: string,
  db: KarenPrismaDb = defaultPrisma as unknown as KarenPrismaDb,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.karenProcessedAnswer.deleteMany({ where: { userId } });
    await tx.karenInterview.deleteMany({ where: { userId } });
  });
}

/**
 * Auth-scoped store: every read/write uses the verified session user id.
 * Rejects mismatched state.userId on set. Production path for all DB ownership.
 */
export function createAuthedKarenSessionStore(
  authenticatedUserId: string,
  inner: KarenSessionStore = createPrismaKarenSessionStore(),
): KarenSessionStore {
  if (!authenticatedUserId || authenticatedUserId.length < 8) {
    throw new KarenUserScopeError("authenticatedUserId required");
  }
  return {
    async get(userId) {
      if (userId !== authenticatedUserId) {
        throw new KarenUserScopeError("Refusing cross-user Karen read");
      }
      return inner.get(authenticatedUserId);
    },
    async set(state) {
      if (state.userId !== authenticatedUserId) {
        throw new KarenUserScopeError("Refusing to persist Karen state for another user");
      }
      return inner.set({ ...state, userId: authenticatedUserId });
    },
  };
}

/**
 * Resolve an auth-scoped store from the server session.
 * Returns null when unauthenticated. Never accepts client-supplied user ids.
 */
export async function resolveAuthedKarenStore(
  sessionUserIdFn: () => Promise<string | null> = defaultSessionUserId,
  inner?: KarenSessionStore,
): Promise<{ userId: string; store: KarenSessionStore } | null> {
  const userId = await sessionUserIdFn();
  if (!userId) return null;
  return {
    userId,
    store: createAuthedKarenSessionStore(userId, inner ?? createPrismaKarenSessionStore()),
  };
}

async function defaultSessionUserId(): Promise<string | null> {
  const { sessionUserId } = await import("@/lib/session-user");
  return sessionUserId();
}

/** True when Karen tables are missing (P2021/P2022) — callers may fall back to memory. */
export function isMissingKarenSchema(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")
  );
}

/** Audit helper: list production entrypoints that may touch Karen persistence. */
export const KAREN_PRODUCTION_AUTH_CONTRACT = {
  /** Only these factories may establish DB ownership. */
  allowedIdentitySources: ["sessionUserId", "resolveAuthedKarenStore", "createAuthedKarenSessionStore"] as const,
  /** Bare Prisma store must not be exposed to request handlers without the auth wrapper. */
  forbidClientUserIdOwnership: true,
} as const;
