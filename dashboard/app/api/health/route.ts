/**
 * Liveness — process is up. No dependency checks.
 */

import { NextResponse } from "next/server";
import { getRequestIdFromRequest } from "@/lib/ops/request-id";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestIdFromRequest(req);
  return NextResponse.json(
    { ok: true, status: "alive", service: "buddie-dashboard" },
    {
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": requestId,
      },
    },
  );
}
