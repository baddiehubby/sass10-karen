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
import { getTrustedClientIp } from "@/lib/client-ip";
import { assertLicenseDomainFromRequest } from "@/lib/license-domain";
import { prisma } from "@/lib/prisma";
import { analyticsEventBodySchema } from "@/lib/validation";
import {
  licenseKeyFingerprint,
  staticLicenseKeyWriteAllowed,
  verifyWidgetCredential,
} from "@/lib/widget-credential";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Buddy-Widget-Opt-In",
    "Cache-Control": "no-store",
  };
}

function clientIp(req: Request): string {
  return getTrustedClientIp(req);
}

function bearerFromAuth(header: string | null): string {
  const h = (header || "").trim();
  if (!h.toLowerCase().startsWith("bearer ")) return "";
  return h.slice(7).trim();
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
  const widgetCredential =
    (parsed.data.widgetCredential || "").trim() || bearerFromAuth(req.headers.get("authorization"));

  const ip = clientIp(req);
  if (!checkAnalyticsRateLimit(licenseKey || sessionToken || widgetCredential.slice(0, 32) || "anon", ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: corsHeaders() });
  }

  let resolvedLicense: {
    id: string;
    key: string;
    userId: string;
    expiresAt: Date;
    plan: string;
    lemonSqueezySubscriptionStatus: string | null;
    domain?: string | null;
  } | null = null;

  if (widgetCredential) {
    const cred = await verifyWidgetCredential(widgetCredential, { requiredScope: "analytics:write" });
    if (!cred) {
      return NextResponse.json({ error: "Invalid or expired credential" }, { status: 403, headers: corsHeaders() });
    }
    const row = await prisma.license.findUnique({
      where: { id: cred.licenseId },
      select: {
        id: true,
        key: true,
        userId: true,
        expiresAt: true,
        plan: true,
        lemonSqueezySubscriptionStatus: true,
        domain: true,
      },
    });
    if (!row || !isLicenseActive(row) || licenseKeyFingerprint(row.key) !== cred.keyFingerprint) {
      return NextResponse.json({ error: "Invalid license" }, { status: 403, headers: corsHeaders() });
    }
    if (row.domain) {
      const domainCheck = assertLicenseDomainFromRequest(row.domain, req, domain);
      if (!domainCheck.ok) {
        return NextResponse.json({ error: "Domain not allowed" }, { status: 403, headers: corsHeaders() });
      }
    }
    resolvedLicense = row;
  } else {
    resolvedLicense = await resolveLicenseForWidgetAuth({ licenseKey, sessionToken });
    if (
      !resolvedLicense ||
      resolvedLicense.expiresAt.getTime() < Date.now() ||
      !isLicenseActive(resolvedLicense)
    ) {
      return NextResponse.json({ error: "Invalid license" }, { status: 403, headers: corsHeaders() });
    }

    const full = await prisma.license.findUnique({
      where: { id: resolvedLicense.id },
      select: { domain: true },
    });
    // Unbound static key / session alone must not be permanent write auth.
    if (licenseKey?.trim() && !staticLicenseKeyWriteAllowed(full?.domain)) {
      return NextResponse.json(
        {
          error: "Short-lived widget credential required",
          code: "widget_credential_required",
          hint: "POST /api/licenses/widget-credential",
        },
        { status: 403, headers: corsHeaders() },
      );
    }
    if (full?.domain) {
      const domainCheck = assertLicenseDomainFromRequest(full.domain, req, domain);
      if (!domainCheck.ok) {
        return NextResponse.json({ error: "Domain not allowed" }, { status: 403, headers: corsHeaders() });
      }
    }
    // Session-token path: only if token resolved to an active license (already checked).
    // Still require domain bind OR credential for write — sessionToken alone on unbound is blocked
    // unless caller also presents a bound domain license (handled above for licenseKey).
    if (!licenseKey?.trim() && sessionToken?.trim() && !staticLicenseKeyWriteAllowed(full?.domain)) {
      return NextResponse.json(
        {
          error: "Short-lived widget credential required",
          code: "widget_credential_required",
        },
        { status: 403, headers: corsHeaders() },
      );
    }
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
