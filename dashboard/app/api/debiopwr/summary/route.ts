import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { assertDebiopwrAdmin } from "@/lib/debiopwr-admin";
import { buildDebiopwrSummary } from "@/lib/debiopwr-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!assertDebiopwrAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = 30;
  const summary = await buildDebiopwrSummary(days);
  return NextResponse.json({ ok: true, ...summary });
}
