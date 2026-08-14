import { NextResponse, type NextRequest } from "next/server";
import { checkInNotificationBody, moodNeedsCheckIn } from "@/lib/presence-state";
import { getPresenceForLicense } from "@/lib/presence-service";
import { sendPushToLicense } from "@/lib/presence-push";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic";

/** Internal/cron-friendly endpoint to nudge users after periodic sync detects concern. */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  const licenseKey = req.nextUrl.searchParams.get("licenseKey")?.trim() || "";
  if (!licenseKey) {
    return NextResponse.json({ error: "licenseKey required" }, { status: 400 });
  }

  const cronOk = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
  if (!cronOk) {
    const userId = await sessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const owned = await prisma.license.findFirst({
      where: { key: licenseKey, userId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const state = await getPresenceForLicense(licenseKey);
  if (!state) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!moodNeedsCheckIn(state)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const body = checkInNotificationBody(state);
  const sent = await sendPushToLicense(licenseKey, {
    title: `${state.companionName} is checking in`,
    body,
    url: "/dashboard",
  });

  return NextResponse.json({ ok: true, sent });
}
