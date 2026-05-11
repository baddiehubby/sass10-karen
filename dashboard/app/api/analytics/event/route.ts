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

  const { licenseKey, domain, mood, timestamp: tsRaw, messageSnippet } = parsed.data;

  const ip = clientIp(req);
  if (!checkAnalyticsRateLimit(licenseKey, ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: corsHeaders() });
  }

  const license = await prisma.license.findUnique({ where: { key: licenseKey } });
  if (!license || license.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invalid license" }, { status: 403, headers: corsHeaders() });
  }

  let at = new Date();
  if (tsRaw) {
    const parsedTs = new Date(tsRaw);
    if (!Number.isNaN(parsedTs.getTime())) at = parsedTs;
  }

  await prisma.moodEvent.create({
    data: {
      licenseId: license.id,
      mood,
      domain: domain ?? null,
      messageSnippet: messageSnippet ?? null,
      timestamp: at,
    },
  });

  if (mood === "happy") {
    await awardBadgeByName(license.userId, "First Smile");
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
