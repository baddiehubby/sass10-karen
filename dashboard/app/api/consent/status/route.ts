import { NextResponse, type NextRequest } from "next/server";
import { resolveLicenseForWidgetAuth } from "@/lib/anonymized-mood-ingest";
import { hasConsent } from "@/lib/consent-service";
import { isLicenseActive } from "@/lib/free-license";

export const dynamic = "force-dynamic";

/** Public consent flags for widget (pseudonymous session token only). */
export async function GET(req: NextRequest) {
  const sessionToken = req.nextUrl.searchParams.get("sessionToken")?.trim() || "";
  const licenseKey = req.nextUrl.searchParams.get("licenseKey")?.trim() || "";

  const license = await resolveLicenseForWidgetAuth({ licenseKey, sessionToken });
  const userId =
    license && isLicenseActive(license) ? license.userId : null;

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
