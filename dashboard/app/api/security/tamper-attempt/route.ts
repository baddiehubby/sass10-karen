import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { tamperAttemptBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, tamperAttemptBodySchema);
  if (!parsed.ok) {
    const r = parsed.response;
    for (const [k, v] of Object.entries(corsHeaders())) r.headers.set(k, v);
    return r;
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.warn("[tamper-attempt]", parsed.data);
  }

  const res = new NextResponse(null, { status: 204 });
  for (const [k, v] of Object.entries(corsHeaders())) res.headers.set(k, v);
  return res;
}
