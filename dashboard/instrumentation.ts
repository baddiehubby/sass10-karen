/**
 * Next.js instrumentation — runs once on Node server start.
 * Fail fast on missing production secrets (skipped during build phase).
 * Best-effort additive schema repair for production DB drift that blocks auth.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { assertProductionEnv } = await import("@/lib/env");
  assertProductionEnv();

  // Additive only — never drop/alter existing columns. Safe if already applied.
  // Prod DB has lagged schema.prisma (P2022 columns + missing UserConsent) and that
  // surfaces as NextAuth AccessDenied / OAUTH_CALLBACK_HANDLER_ERROR on Google login.
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "eidataConsentCompleted" BOOLEAN NOT NULL DEFAULT false`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "widgetSessionToken" TEXT`,
      );
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "UserConsent" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "purpose" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "UserConsent_userId_purpose_key" ON "UserConsent"("userId", "purpose")`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "UserConsent_userId_status_idx" ON "UserConsent"("userId", "status")`,
      );
    } catch (err) {
      const name = err instanceof Error ? err.name : "unknown_error";
      console.warn("[instrumentation] additive schema ensure deferred:", name);
    }
  }
}
