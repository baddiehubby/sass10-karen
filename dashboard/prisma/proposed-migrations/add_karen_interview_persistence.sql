-- PROPOSED ONLY. Do not apply until Stage 6B-1 is approved for your environment.
-- Additive Karen interviewer persistence (separate from Buddy Soul / MemoryFragment).
--
-- Compatible with databases that evolved via `prisma db push` (see MIGRATION_PLAN.md).
-- Safe to re-run: IF NOT EXISTS guards throughout.
--
-- Schema parity notes (Stage 6B-1.1 audit):
-- - Table/column names match prisma/schema.prisma KarenInterview / KarenProcessedAnswer.
-- - payload is JSONB (Prisma Json on PostgreSQL).
-- - updatedAt has DEFAULT CURRENT_TIMESTAMP so raw SQL inserts are valid; Prisma @updatedAt still overwrites on client writes.
-- - User → KarenInterview ON DELETE CASCADE; KarenInterview → KarenProcessedAnswer ON DELETE CASCADE.
-- - @@unique([userId, fingerprint]) → unique index below.
-- - KarenProcessedAnswer.userId is denormalized (no direct User FK), matching Prisma.

CREATE TABLE IF NOT EXISTS "KarenInterview" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KarenInterview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KarenInterview_userId_key" ON "KarenInterview"("userId");
CREATE INDEX IF NOT EXISTS "KarenInterview_updatedAt_idx" ON "KarenInterview"("updatedAt");

CREATE TABLE IF NOT EXISTS "KarenProcessedAnswer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KarenProcessedAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KarenProcessedAnswer_userId_fingerprint_key"
  ON "KarenProcessedAnswer"("userId", "fingerprint");
CREATE INDEX IF NOT EXISTS "KarenProcessedAnswer_userId_createdAt_idx"
  ON "KarenProcessedAnswer"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KarenInterview_userId_fkey'
  ) THEN
    ALTER TABLE "KarenInterview"
      ADD CONSTRAINT "KarenInterview_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KarenProcessedAnswer_interviewId_fkey'
  ) THEN
    ALTER TABLE "KarenProcessedAnswer"
      ADD CONSTRAINT "KarenProcessedAnswer_interviewId_fkey"
      FOREIGN KEY ("interviewId") REFERENCES "KarenInterview"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
