import { NextResponse } from "next/server";
import { checkAnalyticsRateLimit } from "@/lib/analytics-rate-limit";
import { awardBadgeByName } from "@/lib/badges";
import { parseJsonBody } from "@/lib/api-json";
import { prisma } from "@/lib/prisma";
import { analyticsEventBodySchema } from "@/lib/validation";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

function anonymizedSessionTokenFromLicense(licenseKey: string): string {
  let hash = 2166136261;
  const source = `${licenseKey}:buddy-private-v1`;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `bdy_${(hash >>> 0).toString(16).padStart(8, "0")}`;
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

  const { licenseKey, sessionToken, domain, mood, timestamp: tsRaw, messageSnippet } = parsed.data;

  const ip = clientIp(req);
  if (!checkAnalyticsRateLimit(licenseKey || sessionToken || "anon", ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: corsHeaders() });
  }

  const directLicense =
    licenseKey && licenseKey.trim()
      ? await prisma.license.findUnique({ where: { key: licenseKey } })
      : null;

  let resolvedLicense = directLicense;
  if (!resolvedLicense && sessionToken) {
    // Privacy mode fallback: match anonymized session token without requiring raw license key in payload.
    const activeLicenses = await prisma.license.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: { id: true, key: true, userId: true, expiresAt: true },
    });
    const match = activeLicenses.find((l) => anonymizedSessionTokenFromLicense(l.key) === sessionToken) || null;
    if (match) {
      resolvedLicense = await prisma.license.findUnique({ where: { id: match.id } });
    }
  }

  if (!resolvedLicense || resolvedLicense.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invalid license" }, { status: 403, headers: corsHeaders() });
  }

  let at = new Date();
  if (tsRaw) {
    const parsedTs = new Date(tsRaw);
    if (!Number.isNaN(parsedTs.getTime())) at = parsedTs;
  }

  await prisma.moodEvent.create({
    data: {
      licenseId: resolvedLicense.id,
      mood,
      domain: domain ?? null,
      messageSnippet: messageSnippet ?? null,
      timestamp: at,
    },
  });

  if (mood === "happy") {
    await awardBadgeByName(resolvedLicense.userId, "First Smile");
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
