/**
 * Internal cost telemetry — operators only.
 * Never linked from product UI. Disabled when secret unset.
 *
 * Auth: Authorization Bearer or x-buddie-telemetry-secret matching
 * BUDDIE_INTERNAL_TELEMETRY_SECRET (or CRON_SECRET as fallback).
 */

import { NextResponse, type NextRequest } from "next/server";
import { buildInternalCostTelemetry } from "@/src/intelligence/cost";
import { timingSafeSecretEqual } from "@/lib/widget-credential";

export const dynamic = "force-dynamic";

function expectedSecret(): string | null {
  const a = process.env.BUDDIE_INTERNAL_TELEMETRY_SECRET?.trim();
  const b = process.env.CRON_SECRET?.trim();
  return a || b || null;
}

function authorized(req: NextRequest): boolean {
  const expected = expectedSecret();
  if (!expected) return false;
  const header = req.headers.get("authorization")?.trim() ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const custom = req.headers.get("x-buddie-telemetry-secret")?.trim() ?? "";
  return timingSafeSecretEqual(bearer, expected) || timingSafeSecretEqual(custom, expected);
}

export async function GET(req: NextRequest) {
  if (!expectedSecret()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const telemetry = buildInternalCostTelemetry();
  return NextResponse.json(telemetry, {
    headers: {
      "Cache-Control": "no-store",
      "X-Buddie-Audience": "internal-ops",
    },
  });
}
