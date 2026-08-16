/**
 * Next.js instrumentation — runs once on Node server start.
 * Fail fast on missing production secrets (skipped during build phase).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { assertProductionEnv } = await import("@/lib/env");
  assertProductionEnv();
}
