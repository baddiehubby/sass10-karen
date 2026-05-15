import { NextResponse } from "next/server";
import { parseQuery } from "@/lib/api-json";
import { checkAnalyticsRateLimit } from "@/lib/analytics-rate-limit";
import { prisma } from "@/lib/prisma";
import { extensionStatsQuerySchema } from "@/lib/validation";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
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

export async function GET(req: Request) {
  const parsed = parseQuery(req, extensionStatsQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { licenseKey } = parsed.data;

  const rateLimitKey = licenseKey;
  if (!checkAnalyticsRateLimit(`extension-stats:${rateLimitKey}`, clientIp(req))) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: corsHeaders() });
  }

  const license = await prisma.license.findUnique({
    where: { key: licenseKey },
    select: { id: true, expiresAt: true },
  });

  if (!license || license.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ totalMoodsToday: 0, activeLicense: false }, { headers: corsHeaders() });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const totalMoodsToday = await prisma.moodEvent.count({
    where: {
      licenseId: license.id,
      timestamp: { gte: startOfToday },
    },
  });

  return NextResponse.json({ totalMoodsToday, activeLicense: true }, { headers: corsHeaders() });
}
