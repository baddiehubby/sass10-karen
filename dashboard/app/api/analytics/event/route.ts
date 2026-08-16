import { NextResponse } from "next/server";
import { checkAnalyticsRateLimit } from "@/lib/analytics-rate-limit";
import {
  anonymizedSessionTokenFromLicense,
  broadRegionFromRequest,
  ingestAnonymizedMoodEvent,
  resolveLicenseForWidgetAuth,
  sourceFromDomain,
} from "@/lib/anonymized-mood-ingest";
import { isLicenseActive } from "@/lib/free-license";
import { awardBadgeByName } from "@/lib/badges";
import { canIngestAnonymizedEvent, widgetOptInFromRequest } from "@/lib/eidata-ingest-policy";
import { hasConsent } from "@/lib/consent-service";
import { parseJsonBody } from "@/lib/api-json";
import { prisma } from "@/lib/prisma";
import { analyticsEventBodySchema } from "@/lib/validation";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Buddy-Widget-Opt-In",
    "Cache-Control": "no-store",
  };
}

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, analyticsEventBodySchema);
  if (!parsed.ok) {
    const r = parsed.response;
    for (const [k, v] of Object.entries(corsHeaders())) {
      r.headers.set(k, v);
    }
    return r;
  }

  const { licenseKey, sessionToken, domain, mood, timestamp: tsRaw } = parsed.data;

  const ip = clientIp(req);
  if (!checkAnalyticsRateLimit(licenseKey || sessionToken || "anon", ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: corsHeaders() });
  }

  const resolvedLicense = await resolveLicenseForWidgetAuth({ licenseKey, sessionToken });

  if (
    !resolvedLicense ||
    resolvedLicense.expiresAt.getTime() < Date.now() ||
    !isLicenseActive(resolvedLicense)
  ) {
    return NextResponse.json({ error: "Invalid license" }, { status: 403, headers: corsHeaders() });
  }

  let at = new Date();
  if (tsRaw) {
    const parsedTs = new Date(tsRaw);
    if (!Number.isNaN(parsedTs.getTime())) at = parsedTs;
  }

  const pseudonymousToken = anonymizedSessionTokenFromLicense(resolvedLicense.key);
  const region = broadRegionFromRequest(req);
  const source = sourceFromDomain(domain);

  const companionConsent = await hasConsent(resolvedLicense.userId, "companion_mood_detection");
  const anonymizedIngest = await canIngestAnonymizedEvent({
    userId: resolvedLicense.userId,
    widgetOptIn: widgetOptInFromRequest(req),
  });

  if (companionConsent) {
    await prisma.moodEvent.create({
      data: {
        licenseId: resolvedLicense.id,
        mood,
        domain: domain ?? null,
        messageSnippet: null,
        timestamp: at,
      },
    });

    if (mood === "happy") {
      await awardBadgeByName(resolvedLicense.userId, "First Smile");
    }
  }

  if (anonymizedIngest.allowed) {
    await ingestAnonymizedMoodEvent({
      sessionToken: pseudonymousToken,
      mood,
      timestamp: at,
      region,
      companionType: "buddy",
      source,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      stored: {
        dashboard: companionConsent,
        anonymized: anonymizedIngest.allowed,
      },
    },
    { headers: corsHeaders() },
  );
}
