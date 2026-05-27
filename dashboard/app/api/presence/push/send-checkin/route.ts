import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkInNotificationBody, moodNeedsCheckIn } from "@/lib/presence-state";
import { getPresenceForLicense } from "@/lib/presence-service";
import { sendPushToLicense } from "@/lib/presence-push";

export const dynamic = "force-dynamic";

/** Internal/cron-friendly endpoint to nudge users after periodic sync detects concern. */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  const session = await getServerSession(authOptions);

  const licenseKey = req.nextUrl.searchParams.get("licenseKey")?.trim() || "";
  if (!licenseKey) {
    return NextResponse.json({ error: "licenseKey required" }, { status: 400 });
  }

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) || Boolean(session?.user?.id);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
