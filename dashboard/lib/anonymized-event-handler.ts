import { NextResponse } from "next/server";
import { checkAnalyticsRateLimit } from "@/lib/analytics-rate-limit";
import {
  anonymizedSessionTokenFromLicense,
  broadRegionFromRequest,
  ingestAnonymizedMoodEvent,
  resolveLicenseForWidgetAuth,
  sourceFromDomain,
} from "@/lib/anonymized-mood-ingest";
import { getTrustedClientIp } from "@/lib/client-ip";
import { canIngestAnonymizedEvent, widgetOptInFromRequest } from "@/lib/eidata-ingest-policy";
import { hasConsent } from "@/lib/consent-service";
import { isLicenseActive } from "@/lib/free-license";
import type { anonymizedMoodEventBodySchema } from "@/lib/validation";
import type { z } from "zod";

export function anonymizedEventCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Buddy-Widget-Opt-In",
    "Cache-Control": "no-store",
  };
}

export async function handleAnonymizedMoodEventPost(
  req: Request,
  data: z.infer<typeof anonymizedMoodEventBodySchema>,
): Promise<NextResponse> {
  const cors = anonymizedEventCorsHeaders();
  const { sessionToken, licenseKey, mood, timestamp: tsRaw, domain, region: clientRegion, companionType, source } =
    data;

  const ip = getTrustedClientIp(req);
  if (!checkAnalyticsRateLimit(sessionToken || licenseKey || "anon", ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: cors });
  }

  let pseudonymousToken = sessionToken?.trim() || "";
  let userId: string | null = null;

  const license = await resolveLicenseForWidgetAuth({
    licenseKey,
    sessionToken: pseudonymousToken || null,
  });

  if (licenseKey?.trim()) {
    if (!license || !isLicenseActive(license)) {
      return NextResponse.json({ error: "Invalid license" }, { status: 403, headers: cors });
    }
    userId = license.userId;
    try {
      pseudonymousToken = anonymizedSessionTokenFromLicense(license.key);
    } catch {
      return NextResponse.json({ error: "Invalid license" }, { status: 403, headers: cors });
    }
  } else if (pseudonymousToken) {
    // Indexed lookup only — never scan all licenses; reject unknown tokens (no spam sink).
    if (license && isLicenseActive(license)) {
      userId = license.userId;
    } else if (!license) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403, headers: cors });
    } else {
      return NextResponse.json({ ok: true, skipped: true, reason: "inactive_license" }, { headers: cors });
    }
  }

  if (!pseudonymousToken) {
    return NextResponse.json({ error: "sessionToken or licenseKey required" }, { status: 400, headers: cors });
  }

  if (userId) {
    const [analyticsGranted, trainingGranted] = await Promise.all([
      hasConsent(userId, "anonymous_analytics"),
      hasConsent(userId, "model_training"),
    ]);
    if (!analyticsGranted && !trainingGranted) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "consent_denied_or_withdrawn" },
        { headers: cors },
      );
    }
  }

  const ingest = await canIngestAnonymizedEvent({
    userId,
    widgetOptIn: widgetOptInFromRequest(req),
  });
  if (!ingest.allowed) {
    return NextResponse.json({ ok: true, skipped: true, reason: ingest.reason }, { headers: cors });
  }

  let at = new Date();
  if (tsRaw) {
    const parsedTs = new Date(tsRaw);
    if (!Number.isNaN(parsedTs.getTime())) at = parsedTs;
  }

  const region = clientRegion ?? broadRegionFromRequest(req);

  await ingestAnonymizedMoodEvent({
    sessionToken: pseudonymousToken,
    mood,
    timestamp: at,
    region,
    companionType: companionType ?? "buddy",
    source: source ?? sourceFromDomain(domain),
  });

  return NextResponse.json(
    {
      ok: true,
      stored: {
        mood,
        region,
        companionType: companionType ?? "buddy",
        source: source ?? sourceFromDomain(domain),
        timestamp: at.toISOString(),
      },
    },
    { headers: cors },
  );
}
