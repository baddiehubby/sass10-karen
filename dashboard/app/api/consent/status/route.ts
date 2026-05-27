import { NextResponse, type NextRequest } from "next/server";
import { anonymizedSessionTokenFromLicense } from "@/lib/anonymized-mood-ingest";
import { hasConsent } from "@/lib/consent-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Public consent flags for widget (pseudonymous session token only). */
export async function GET(req: NextRequest) {
  const sessionToken = req.nextUrl.searchParams.get("sessionToken")?.trim() || "";
  const licenseKey = req.nextUrl.searchParams.get("licenseKey")?.trim() || "";

  let userId: string | null = null;

  if (licenseKey) {
    const license = await prisma.license.findUnique({
      where: { key: licenseKey },
      select: { userId: true, expiresAt: true },
    });
    if (license && license.expiresAt.getTime() > Date.now()) userId = license.userId;
  } else if (sessionToken) {
    const licenses = await prisma.license.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: { key: true, userId: true },
    });
    const match = licenses.find((l) => anonymizedSessionTokenFromLicense(l.key) === sessionToken);
    if (match) userId = match.userId;
  }

  if (!userId) {
    return NextResponse.json({
      ok: true,
      anonymous_analytics: false,
      model_training: false,
      companion_mood_detection: false,
    });
  }

  const [anonymous_analytics, model_training, companion_mood_detection] = await Promise.all([
    hasConsent(userId, "anonymous_analytics"),
    hasConsent(userId, "model_training"),
    hasConsent(userId, "companion_mood_detection"),
  ]);

  return NextResponse.json({
    ok: true,
    anonymous_analytics,
    model_training,
    companion_mood_detection,
  });
}
