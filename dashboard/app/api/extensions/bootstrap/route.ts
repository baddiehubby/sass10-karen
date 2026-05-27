import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { buildCompanionSyncPayload } from "@/lib/companion-sync";

export const dynamic = "force-dynamic";

/** Session-backed license + orb config for browser extension and PWA auto-setup. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await buildCompanionSyncPayload(session.user.id);
  if (!payload) {
    return NextResponse.json({ error: "No license found" }, { status: 404 });
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
