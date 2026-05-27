import { NextResponse } from "next/server";
import { checkAnalyticsRateLimit } from "@/lib/analytics-rate-limit";
import {
  anonymizedSessionTokenFromLicense,
  broadRegionFromRequest,
  ingestAnonymizedMoodEvent,
  sourceFromDomain,
} from "@/lib/anonymized-mood-ingest";
import { canIngestAnonymizedEvent, widgetOptInFromRequest } from "@/lib/eidata-ingest-policy";
import { hasConsent } from "@/lib/consent-service";
import type { anonymizedMoodEventBodySchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import type { z } from "zod";

export function anonymizedEventCorsHeaders() {
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
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function handleAnonymizedMoodEventPost(
  req: Request,
  data: z.infer<typeof anonymizedMoodEventBodySchema>,
): Promise<NextResponse> {
  const cors = anonymizedEventCorsHeaders();
  const { sessionToken, licenseKey, mood, timestamp: tsRaw, domain, region: clientRegion, companionType, source } =
    data;

  const ip = clientIp(req);
  if (!checkAnalyticsRateLimit(sessionToken || licenseKey || "anon", ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: cors });
  }

  let pseudonymousToken = sessionToken?.trim() || "";
  let userId: string | null = null;

  if (licenseKey?.trim()) {
    const license = await prisma.license.findUnique({
      where: { key: licenseKey.trim() },
      select: { id: true, key: true, userId: true, expiresAt: true },
    });
    if (!license || license.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Invalid license" }, { status: 403, headers: cors });
    }
    userId = license.userId;
    pseudonymousToken = anonymizedSessionTokenFromLicense(license.key);
  } else if (pseudonymousToken) {
    const activeLicenses = await prisma.license.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: { key: true, userId: true },
    });
    const match = activeLicenses.find((l) => anonymizedSessionTokenFromLicense(l.key) === pseudonymousToken);
    if (match) userId = match.userId;
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
