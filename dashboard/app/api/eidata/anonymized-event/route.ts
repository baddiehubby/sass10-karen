import { NextResponse } from "next/server";
import { anonymizedEventCorsHeaders, handleAnonymizedMoodEventPost } from "@/lib/anonymized-event-handler";
import { parseJsonBody } from "@/lib/api-json";
import { anonymizedMoodEventBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** @deprecated Prefer POST /api/analytics/anonymized-event */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: anonymizedEventCorsHeaders() });
}

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, anonymizedMoodEventBodySchema);
  if (!parsed.ok) {
    const r = parsed.response;
    for (const [k, v] of Object.entries(anonymizedEventCorsHeaders())) r.headers.set(k, v);
    return r;
  }
  return handleAnonymizedMoodEventPost(req, parsed.data);
}
