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
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "eidataConsentCompleted" BOOLEAN NOT NULL DEFAULT false`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "widgetSessionToken" TEXT`,
      );
    } catch (err) {
      const name = err instanceof Error ? err.name : "unknown_error";
      console.warn("[instrumentation] additive schema ensure deferred:", name);
    }
  }
}
