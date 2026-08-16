/**
 * Readiness — can serve traffic (env soft-check + database connectivity).
 * NEVER echoes connection strings, secrets, or env values.
 */

import { NextResponse } from "next/server";
import { productionEnvStatus } from "@/lib/env";
import { checkDatabaseConnectivity } from "@/lib/ops/db-health";
import { getRequestIdFromRequest } from "@/lib/ops/request-id";
import { logStructured } from "@/lib/ops/logger";
import { observeApiRoute } from "@/lib/ops/api-telemetry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return observeApiRoute(req, "/api/ready", async () => {
    const requestId = getRequestIdFromRequest(req);
    const isProd =
      process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    const env = isProd ? productionEnvStatus() : { ok: true, missingKeys: [] as string[] };
    const db = await checkDatabaseConnectivity();

    const ready = env.ok && db.ok;
    if (!ready) {
      logStructured({
        level: "warn",
        msg: "readiness failed",
        event: "ops.readiness",
        requestId,
        route: "/api/ready",
        outcome: env.ok ? "db_unavailable" : "env_incomplete",
        errorCode: db.errorCode,
        durationMs: db.latencyMs,
      });
    }

    return NextResponse.json(
      {
        ok: ready,
        status: ready ? "ready" : "not_ready",
        checks: {
          env: env.ok ? "ok" : "incomplete",
          database: db.ok ? "ok" : "unavailable",
          databaseLatencyMs: db.latencyMs,
        },
      },
      {
        status: ready ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
          "x-request-id": requestId,
        },
      },
    );
  });
}
