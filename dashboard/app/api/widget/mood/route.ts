import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { parseJsonBody, parseQuery } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { isLicenseActive } from "@/lib/free-license";
import { assertLicenseDomainFromRequest } from "@/lib/license-domain";
import { prisma } from "@/lib/prisma";
import { widgetMoodGetQuerySchema, widgetMoodPostSchema } from "@/lib/validation";

/**
 * Collaborative mood — writes require the secret license key (never licenseId alone).
 * Bound licenses require Origin/Referer match.
 * Reads require licenseKey, or a session that owns the licenseId.
 */
export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, widgetMoodPostSchema);
  if (!parsed.ok) return parsed.response;

  const licenseKey = (parsed.data.licenseKey || "").trim();
  if (!licenseKey) {
    return NextResponse.json({ error: "licenseKey required" }, { status: 400 });
  }

  const { mood } = parsed.data;
  const ttlSeconds = Math.min(Math.max(parsed.data.ttlSeconds ?? 60, 5), 3600);

  const license = await prisma.license.findFirst({
    where: { key: licenseKey },
    select: {
      id: true,
      expiresAt: true,
      plan: true,
      lemonSqueezySubscriptionStatus: true,
      domain: true,
    },
  });
  if (!license || !isLicenseActive(license)) {
    return NextResponse.json({ error: "Invalid license" }, { status: 403 });
  }

  const domainCheck = assertLicenseDomainFromRequest(license.domain, req);
  if (!domainCheck.ok) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
  }

  await prisma.license.update({
    where: { id: license.id },
    data: {
      forcedMood: mood,
      forcedMoodUntil: new Date(Date.now() + ttlSeconds * 1000),
    },
  });

  await prisma.collaborativeRoom.upsert({
    where: { licenseId: license.id },
    update: { mood },
    create: { licenseId: license.id, mood },
  });

  return NextResponse.json({ ok: true, mood, ttlSeconds, licenseId: license.id });
}

export async function GET(req: Request) {
  const parsed = parseQuery(req, widgetMoodGetQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { licenseId, licenseKey } = parsed.data;

  if (licenseKey?.trim()) {
    const byKey = await prisma.license.findFirst({
      where: { key: licenseKey.trim() },
      select: {
        id: true,
        expiresAt: true,
        plan: true,
        lemonSqueezySubscriptionStatus: true,
        domain: true,
      },
    });
    if (!byKey || !isLicenseActive(byKey)) {
      return NextResponse.json({ error: "Invalid license" }, { status: 403 });
    }
    const domainCheck = assertLicenseDomainFromRequest(byKey.domain, req);
    if (!domainCheck.ok) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }
    if (licenseId && byKey.id !== licenseId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const room = await prisma.collaborativeRoom.findUnique({
      where: { licenseId: byKey.id },
      select: { mood: true, updatedAt: true },
    });
    return NextResponse.json({
      mood: room?.mood || "neutral",
      updatedAt: room?.updatedAt || null,
    });
  }

  // Session owner may read their own collaborative room by licenseId
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !licenseId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const owned = await prisma.license.findFirst({
    where: { id: licenseId, userId: session.user.id },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const room = await prisma.collaborativeRoom.findUnique({
    where: { licenseId: owned.id },
    select: { mood: true, updatedAt: true },
  });
  return NextResponse.json({
    mood: room?.mood || "neutral",
    updatedAt: room?.updatedAt || null,
  });
}
