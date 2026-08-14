-- PROPOSED ONLY. Do not apply until approved.
-- Migration A: production auth column
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "eidataConsentCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Migration B: Buddy Soul Engine (additive)
CREATE TABLE IF NOT EXISTS "BuddyBond" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bondDepth" INTEGER NOT NULL DEFAULT 0,
  "buddyMood" TEXT NOT NULL DEFAULT 'curious',
  "buddyEnergy" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "evolutionStage" TEXT NOT NULL DEFAULT 'awakening',
  "humorTone" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mysticismTone" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "warmthTone" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "lastPresence" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuddyBond_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BuddyBond_userId_key" ON "BuddyBond"("userId");

CREATE TABLE IF NOT EXISTS "MemoryFragment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bornFromMood" TEXT NOT NULL,
  "verse" TEXT NOT NULL,
  "orbEcho" TEXT NOT NULL DEFAULT 'held a quiet light',
  "hidden" BOOLEAN NOT NULL DEFAULT true,
  "discoveredAt" TIMESTAMP(3),
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoryFragment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MemoryFragment_userId_hidden_idx" ON "MemoryFragment"("userId", "hidden");

CREATE TABLE IF NOT EXISTS "UnlockedAura" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "auraId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "rarity" TEXT NOT NULL DEFAULT 'common',
  "origin" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnlockedAura_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UnlockedAura_userId_auraId_key" ON "UnlockedAura"("userId", "auraId");

CREATE TABLE IF NOT EXISTS "DailyRitual" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ritualDate" DATE NOT NULL,
  "ritualType" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "buddyWhisper" TEXT,
  CONSTRAINT "DailyRitual_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyRitual_userId_ritualDate_ritualType_key" ON "DailyRitual"("userId", "ritualDate", "ritualType");
CREATE INDEX IF NOT EXISTS "DailyRitual_userId_ritualDate_idx" ON "DailyRitual"("userId", "ritualDate");

ALTER TABLE "BuddyBond"
  ADD CONSTRAINT "BuddyBond_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryFragment"
  ADD CONSTRAINT "MemoryFragment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "BuddyBond"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnlockedAura"
  ADD CONSTRAINT "UnlockedAura_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "BuddyBond"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyRitual"
  ADD CONSTRAINT "DailyRitual_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "BuddyBond"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
