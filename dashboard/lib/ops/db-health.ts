/**
 * Database connectivity probe for readiness.
 */

import { prisma } from "@/lib/prisma";

export async function checkDatabaseConnectivity(timeoutMs = 2500): Promise<{
  ok: boolean;
  latencyMs: number;
  errorCode?: string;
}> {
  const started = Date.now();
  try {
    const probe = prisma.$queryRaw`SELECT 1 AS ok`;
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("db_timeout")), timeoutMs);
    });
    await Promise.race([probe, timeout]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      errorCode: err instanceof Error ? err.message.slice(0, 40) : "db_error",
    };
  }
}
